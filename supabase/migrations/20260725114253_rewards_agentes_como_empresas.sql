-- Yaub Rewards · el agente ES la empresa; el tenant es el dueño de la cuenta.
--
-- Corrección de modelo: una empresa de Rewards NO reclama un tenant propio.
-- El tenant es la cuenta empresarial del usuario y dentro de él viven TODOS sus
-- agentes; cada agente es una empresa de Rewards a la que se le activan ofertas.
--
-- La versión anterior de ensure_empresa_tenant tomaba "cualquier tenant libre"
-- del usuario, lo que colgó Alianzatel del tenant "Mariscos La Anacua". Aquí se
-- arregla la función y los datos.

-- ── Función: liga la empresa al tenant del usuario, sin exclusividad ─────────
create or replace function rewards.ensure_empresa_tenant(p_empresa_id uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_emp rewards.empresas;
  v_app_user public.app_users;
  v_tenant_id uuid;
  v_plan_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_emp from rewards.empresas where id = p_empresa_id;
  if not found then
    raise exception 'Empresa no encontrada';
  end if;
  if v_emp.user_id <> v_uid and not rewards.is_admin() then
    raise exception 'No autorizado';
  end if;

  if v_emp.tenant_id is not null then
    return v_emp.tenant_id;
  end if;

  select * into v_app_user from public.app_users where auth_user_id = v_emp.user_id;
  if not found then
    raise exception 'La cuenta no tiene perfil de plataforma Yaub';
  end if;

  -- 1) su tenant activo; 2) su membresía por defecto. Sin exigir que esté
  --    "libre": varias empresas del mismo dueño comparten tenant, igual que
  --    varios agentes comparten cuenta en la plataforma.
  v_tenant_id := v_app_user.tenant_id;

  if v_tenant_id is null then
    select m.tenant_id into v_tenant_id
    from public.user_tenant_memberships m
    join public.tenants t on t.id = m.tenant_id and t.is_active
    where m.app_user_id = v_app_user.id
      and m.is_active
    order by m.is_default desc, (m.role = 'OWNER') desc, m.created_at
    limit 1;
  end if;

  -- 3) sin tenant: se le crea su cuenta empresarial
  if v_tenant_id is null then
    v_slug := lower(regexp_replace(translate(v_emp.nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug) || '-' || substr(gen_random_uuid()::text, 1, 8);

    insert into public.tenants (name, slug, is_active, account_type, onboarding_type, company_name, source)
    values (v_emp.nombre, v_slug, true, 'self_service', 'self_service', v_emp.nombre, 'rewards')
    returning id into v_tenant_id;

    select id into v_plan_id from public.tenant_plans where slug = 'self_service' limit 1;
    if v_plan_id is null then
      select id into v_plan_id from public.tenant_plans where slug = 'free' limit 1;
    end if;
    if v_plan_id is not null then
      update public.tenants set plan_id = v_plan_id where id = v_tenant_id;
      insert into public.tenant_subscriptions (tenant_id, plan_id, status)
      values (v_tenant_id, v_plan_id, 'active');
    end if;

    insert into public.user_tenant_memberships (app_user_id, tenant_id, role, is_active, is_default)
    values (v_app_user.id, v_tenant_id, 'BUSINESS_OWNER', true, true)
    on conflict do nothing;
  end if;

  update public.app_users
  set tenant_id = coalesce(tenant_id, v_tenant_id)
  where id = v_app_user.id;

  update rewards.empresas set tenant_id = v_tenant_id where id = p_empresa_id;
  return v_tenant_id;
end;
$$;

revoke execute on function rewards.ensure_empresa_tenant(uuid) from public, anon;
grant execute on function rewards.ensure_empresa_tenant(uuid) to authenticated, service_role;

-- ── Agentes de mis tenants, con su activación en Rewards ─────────────────────
-- El listado del panel empresarial: TODOS los agentes de las cuentas donde el
-- usuario es miembro, marcando cuáles ya están activados en Rewards (tienen
-- empresa + ofertas) y cuáles no.
create or replace function rewards.mis_agentes()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with yo as (
    select au.id as app_user_id, au.auth_user_id
    from public.app_users au
    where au.auth_user_id = (select auth.uid())
  ),
  mis_tenants as (
    select distinct m.tenant_id
    from public.user_tenant_memberships m, yo
    where m.app_user_id = yo.app_user_id and m.is_active
    union
    select au.tenant_id from public.app_users au, yo
    where au.id = yo.app_user_id and au.tenant_id is not null
  )
  select coalesce(jsonb_agg(x order by x->>'activado' desc, x->>'nombre'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'assistant_id', a.id,
      'nombre', a.name,
      'tenant_id', a.tenant_id,
      'tenant', t.name,
      'activo', a.is_active,
      'widget_key', a.widget_public_key,
      'activado', (e.id is not null),
      'empresa_id', e.id,
      'ofertas', coalesce((select count(*) from rewards.ofertas o where o.empresa_id = e.id and o.activa), 0),
      'interacciones_incluidas', coalesce(tr.interacciones_incluidas, 100),
      'interacciones_usadas', case
        when tr.id is null then 0 else rewards.interacciones_agente(a.id, tr.trial_started_at)
      end,
      'en_trial', (tr.id is not null and tr.activated_at is null),
      'con_plan', (tr.id is not null and tr.activated_at is not null)
    ) as x
    from public.assistants a
    join public.tenants t on t.id = a.tenant_id
    left join rewards.empresas e
      on e.assistant_id = a.id and e.user_id = (select auth.uid())
    left join rewards.agentes_trial tr on tr.assistant_id = a.id
    where a.tenant_id in (select tenant_id from mis_tenants)
      and a.archived_at is null
  ) s;
$$;

revoke execute on function rewards.mis_agentes() from public, anon;
grant execute on function rewards.mis_agentes() to authenticated, service_role;

-- ── Activar un agente existente en Rewards ──────────────────────────────────
-- Crea (o reusa) la empresa de Rewards ligada a ese agente para poder colgarle
-- ofertas. No toca al agente: solo lo registra como empresa de Rewards.
create or replace function rewards.activar_agente_en_rewards(p_assistant_id uuid)
returns rewards.empresas
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a public.assistants;
  v_row rewards.empresas;
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_a from public.assistants where id = p_assistant_id and archived_at is null;
  if not found then
    raise exception 'Agente no encontrado';
  end if;

  -- el agente debe vivir en un tenant del usuario
  select exists (
    select 1
    from public.app_users au
    left join public.user_tenant_memberships m on m.app_user_id = au.id and m.is_active
    where au.auth_user_id = v_uid
      and (au.tenant_id = v_a.tenant_id or m.tenant_id = v_a.tenant_id)
  ) into v_ok;
  if not v_ok and not rewards.is_admin() then
    raise exception 'Ese agente no es de tu cuenta';
  end if;

  select * into v_row from rewards.empresas where assistant_id = p_assistant_id;
  if found then
    return v_row;
  end if;

  insert into rewards.empresas (user_id, nombre, estado, tenant_id, assistant_id)
  values (v_uid, v_a.name, 'autorizada', v_a.tenant_id, p_assistant_id)
  returning * into v_row;

  insert into rewards.agentes_trial (assistant_id, empresa_id, tenant_id)
  values (p_assistant_id, v_row.id, v_a.tenant_id)
  on conflict (assistant_id) do nothing;

  return v_row;
end;
$$;

revoke execute on function rewards.activar_agente_en_rewards(uuid) from public, anon;
grant execute on function rewards.activar_agente_en_rewards(uuid) to authenticated, service_role;

-- ── Datos: corregir lo que la heurística anterior dejó mal ───────────────────
-- Alianzatel y Prestamee son de jacobopayan@yaub.ai, dueño del tenant "Yaub":
-- Alianzatel habia quedado colgada de "Mariscos La Anacua".
update rewards.empresas e
set tenant_id = (
  select au.tenant_id from public.app_users au
  where au.auth_user_id = e.user_id and au.tenant_id is not null
  union all
  select m.tenant_id
  from public.app_users au2
  join public.user_tenant_memberships m on m.app_user_id = au2.id and m.is_active
  where au2.auth_user_id = e.user_id
  order by 1
  limit 1
)
where e.nombre in ('Alianzatel', 'Prestamee');

-- Yaub Móvil ya está conectado de verdad: su agente es el "Yaub Movil" del
-- tenant Yaub (es el único con la herramienta de Rewards cableada).
update rewards.empresas e
set assistant_id = a.id,
    tenant_id = a.tenant_id
from public.assistants a
where a.name = 'Yaub Movil'
  and a.archived_at is null
  and e.nombre = 'Yaub Móvil'
  and e.assistant_id is null;

notify pgrst, 'reload schema';
