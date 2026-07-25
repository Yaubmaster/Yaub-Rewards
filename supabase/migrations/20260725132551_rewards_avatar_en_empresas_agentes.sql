-- El detalle del agente necesita su foto para poder cambiarla desde Rewards.
create or replace function rewards.mis_empresas_agentes()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'empresa_id', e.id,
      'empresa', e.nombre,
      'estado', e.estado,
      'creada', e.created_at,
      'tenant_id', e.tenant_id,
      'ofertas', (select count(*) from rewards.ofertas o where o.empresa_id = e.id and o.activa),
      'agente', case when a.id is null then null else jsonb_build_object(
        'id', a.id,
        'nombre', a.name,
        'avatar_url', a.avatar_url,
        'activo', a.is_active,
        'widget_key', a.widget_public_key,
        'interacciones_incluidas', coalesce(t.interacciones_incluidas, 100),
        'interacciones_usadas', case
          when t.id is null then 0
          else rewards.interacciones_agente(a.id, t.trial_started_at)
        end,
        'trial_activo', (t.id is not null and t.activated_at is null),
        'activado', (t.activated_at is not null),
        'pausado', (t.paused_at is not null or not a.is_active)
      ) end
    ) as x
    from rewards.empresas e
    left join public.assistants a
      on a.id = e.assistant_id and a.archived_at is null
    left join rewards.agentes_trial t on t.assistant_id = a.id
    where e.user_id = (select auth.uid())
  ) s;
$$;

notify pgrst, 'reload schema';
