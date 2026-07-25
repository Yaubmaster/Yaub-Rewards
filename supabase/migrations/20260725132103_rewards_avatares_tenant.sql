-- Yaub Rewards · fotos de perfil del tenant y del agente, visibles en toda la app.
--
-- La escritura va por funciones SECURITY INVOKER: quien manda es la RLS de la
-- plataforma. En `tenants` solo BUSINESS_OWNER de esa cuenta puede actualizar
-- ("TENANT_ADMIN can update own tenant"); en `assistants`, el alcance de tenant.
-- Si la RLS no deja pasar el update, row_count = 0 y la función avisa.

-- Cuentas (tenants) que el usuario puede administrar desde Rewards.
create or replace function rewards.mis_tenants()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb)
  from (
    select distinct jsonb_build_object(
      'tenant_id', t.id,
      'nombre', t.name,
      'avatar_url', coalesce(t.logo_url, t.logo_url_light),
      'agentes', (
        select count(*) from public.assistants a
        where a.tenant_id = t.id and a.archived_at is null
      )
    ) as x
    -- el join contra assistants deja fuera cuentas que el usuario ve pero donde
    -- no tiene nada que administrar aquí
    from public.tenants t
    where exists (
      select 1 from public.assistants a
      where a.tenant_id = t.id and a.archived_at is null
    )
  ) s;
$$;

revoke execute on function rewards.mis_tenants() from public, anon;
grant execute on function rewards.mis_tenants() to authenticated, service_role;

create or replace function rewards.guardar_avatar_tenant(p_tenant_id uuid, p_url text)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare v_n int;
begin
  update public.tenants set logo_url = nullif(btrim(p_url), '') where id = p_tenant_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No tienes permiso para editar esta cuenta';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function rewards.guardar_avatar_tenant(uuid, text) from public, anon;
grant execute on function rewards.guardar_avatar_tenant(uuid, text) to authenticated, service_role;

-- El listado de agentes ahora trae las fotos, para que no salgan iconos default.
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
      'avatar_url', a.avatar_url,
      'tenant_avatar', coalesce(t.logo_url, t.logo_url_light),
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

notify pgrst, 'reload schema';
