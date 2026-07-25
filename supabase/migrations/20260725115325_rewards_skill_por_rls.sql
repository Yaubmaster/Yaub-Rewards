-- Yaub Rewards · activar la SKILL de Rewards en un agente, respetando RLS.
--
-- Correccion: la version anterior usaba SECURITY DEFINER y por lo tanto se
-- saltaba la RLS de public.assistants. La plataforma ya tiene las policies
-- correctas (solo agentes de tu tenant; AGENT/AGENT_MANAGER quedan fuera;
-- editar exige BUSINESS_OWNER/ADMIN/OWNER), asi que estas funciones pasan a
-- SECURITY INVOKER y dejan que esa RLS mande.
--
-- "Activar Yaub Rewards" en un agente = agregarle las tools registrar_referido,
-- validar_codigo y liberar_referido, que es lo que ya trae el agente de Yaub
-- Movil. Sin esas tools el agente no puede registrar ni validar codigos.

-- Definicion canonica de la skill (copiada del agente Yaub Movil)
create or replace function rewards.skill_tools()
returns jsonb
language sql immutable
set search_path = ''
as $$
  select '[
    {"type":"function","function":{"name":"registrar_referido",
      "description":"Registra un referido en Yaub Rewards con el código del vendedor y el teléfono del cliente.",
      "parameters":{"type":"object","required":["codigo","cliente_telefono"],"properties":{
        "codigo":{"type":"string","description":"Código del vendedor/freelancer que recomendó al cliente"},
        "cliente_telefono":{"type":"string","description":"Teléfono del cliente que fue referido"}}}}},
    {"type":"function","function":{"name":"validar_codigo",
      "description":"Valida un código de referido de Yaub Rewards.",
      "parameters":{"type":"object","required":["codigo"],"properties":{
        "codigo":{"type":"string","description":"Código de referido a validar"}}}}},
    {"type":"function","function":{"name":"liberar_referido",
      "description":"Libera la comisión del referido al cumplirse un evento del cliente.",
      "parameters":{"type":"object","required":["cliente_telefono","evento"],"properties":{
        "cliente_telefono":{"type":"string","description":"Teléfono del cliente referido"},
        "evento":{"type":"string","description":"Evento que dispara la liberación, ej. primera_recarga"}}}}}
  ]'::jsonb;
$$;

grant execute on function rewards.skill_tools() to authenticated, service_role;

-- ── Listado: sale por la RLS de la plataforma ───────────────────────────────
create or replace function rewards.mis_agentes()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'rewards_activo' desc, x->>'nombre'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'assistant_id', a.id,
      'nombre', a.name,
      'tenant_id', a.tenant_id,
      'tenant', coalesce(t.name, ''),
      'activo', a.is_active,
      'widget_key', a.widget_public_key,
      -- tiene la skill de Rewards cableada
      'rewards_activo', (a.tools @> '[{"function":{"name":"registrar_referido"}}]'::jsonb),
      'empresa_id', e.id,
      'ofertas', coalesce((select count(*) from rewards.ofertas o where o.empresa_id = e.id and o.activa), 0),
      'interacciones_incluidas', coalesce(tr.interacciones_incluidas, 100),
      'interacciones_usadas', case
        when tr.id is null then 0 else rewards.interacciones_agente(a.id, tr.trial_started_at)
      end,
      'con_plan', (tr.id is not null and tr.activated_at is not null)
    ) as x
    from public.assistants a
    left join public.tenants t on t.id = a.tenant_id
    left join rewards.empresas e on e.assistant_id = a.id
    left join rewards.agentes_trial tr on tr.assistant_id = a.id
    where a.archived_at is null
  ) s;
$$;

revoke execute on function rewards.mis_agentes() from public, anon;
grant execute on function rewards.mis_agentes() to authenticated, service_role;

-- ── Escrituras propias de Rewards: policies explicitas ──────────────────────
drop policy if exists empresas_insert on rewards.empresas;
create policy empresas_insert on rewards.empresas
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists agentes_trial_insert on rewards.agentes_trial;
create policy agentes_trial_insert on rewards.agentes_trial
for insert to authenticated
with check (
  exists (select 1 from rewards.empresas e
          where e.id = agentes_trial.empresa_id and e.user_id = (select auth.uid()))
);

grant insert on rewards.empresas to authenticated;
grant insert on rewards.agentes_trial to authenticated;
grant update (assistant_id, tenant_id) on rewards.empresas to authenticated;

-- ── Activar / desactivar la skill en un agente ──────────────────────────────
-- SECURITY INVOKER: el UPDATE sobre public.assistants pasa por la RLS de la
-- plataforma, que solo deja a OWNER / BUSINESS_OWNER / ADMIN del tenant.
create or replace function rewards.activar_rewards_en_agente(p_assistant_id uuid)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid;
  v_nombre text;
  v_emp rewards.empresas;
  v_tocadas int;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  -- La RLS decide si puede verlo
  select a.tenant_id, a.name into v_tenant, v_nombre
  from public.assistants a
  where a.id = p_assistant_id and a.archived_at is null;
  if v_tenant is null then
    raise exception 'Agente no encontrado o no es de tu cuenta';
  end if;

  -- Cablea la skill sin duplicar tools existentes. Si la RLS no deja editar,
  -- no se toca ninguna fila y avisamos.
  update public.assistants a
  set tools = coalesce(a.tools, '[]'::jsonb) || (
        select coalesce(jsonb_agg(t), '[]'::jsonb)
        from jsonb_array_elements(rewards.skill_tools()) t
        where not coalesce(a.tools, '[]'::jsonb) @> jsonb_build_array(
          jsonb_build_object('function', jsonb_build_object('name', t->'function'->>'name'))
        )
      )
  where a.id = p_assistant_id;
  get diagnostics v_tocadas = row_count;
  if v_tocadas = 0 then
    raise exception 'No tienes permiso para editar este agente (necesitas ser dueño de la cuenta)';
  end if;

  -- Registro en Rewards para colgarle ofertas
  select * into v_emp from rewards.empresas where assistant_id = p_assistant_id;
  if not found then
    insert into rewards.empresas (user_id, nombre, estado, tenant_id, assistant_id)
    values (v_uid, v_nombre, 'autorizada', v_tenant, p_assistant_id)
    returning * into v_emp;

    insert into rewards.agentes_trial (assistant_id, empresa_id, tenant_id)
    values (p_assistant_id, v_emp.id, v_tenant)
    on conflict (assistant_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'empresa_id', v_emp.id, 'assistant_id', p_assistant_id);
end;
$$;

revoke execute on function rewards.activar_rewards_en_agente(uuid) from public, anon;
grant execute on function rewards.activar_rewards_en_agente(uuid) to authenticated, service_role;

drop function if exists rewards.activar_agente_en_rewards(uuid);

notify pgrst, 'reload schema';
