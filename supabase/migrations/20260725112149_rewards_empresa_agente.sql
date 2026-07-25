-- Yaub Rewards · modelo empresa = agente, y trial por interacciones.
--
-- 1) Cada empresa de Rewards tiene UN agente (1:1). Los tenants siguen siendo
--    los de la plataforma Yaub, así que una cuenta puede tener varias empresas
--    dentro del mismo tenant y cada una es un agente distinto.
-- 2) El trial deja de ser por días: son 100 INTERACCIONES gratis. Una
--    interacción es lo mismo que factura la plataforma — una fila de
--    public.bot_escalations con counted_for_billing = true — para que el
--    contador del trial y el consumo real nunca se contradigan.

alter table rewards.empresas
  add column if not exists assistant_id uuid references public.assistants(id);

-- 1:1 real: un agente no puede pertenecer a dos empresas
create unique index if not exists empresas_assistant_unico
  on rewards.empresas (assistant_id) where assistant_id is not null;

-- ── Trial por interacciones ──────────────────────────────────────────────────
alter table rewards.agentes_trial
  add column if not exists interacciones_incluidas integer not null default 100;

alter table rewards.agentes_trial
  drop column if exists trial_ends_at;

comment on column rewards.agentes_trial.interacciones_incluidas is
  'Interacciones gratis del trial. Al agotarse el agente se pausa hasta elegir plan.';

-- Interacciones consumidas por un agente desde que arrancó su trial.
create or replace function rewards.interacciones_agente(
  p_assistant_id uuid,
  p_desde timestamptz
)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce(count(*), 0)::int
  from public.bot_escalations be
  where be.assistant_id = p_assistant_id
    and be.counted_for_billing = true
    and be.created_at >= p_desde;
$$;

revoke execute on function rewards.interacciones_agente(uuid, timestamptz) from public, anon;
grant execute on function rewards.interacciones_agente(uuid, timestamptz) to authenticated, service_role;

-- Pausa los agentes que agotaron sus interacciones gratis (reemplaza la pausa
-- por días). Pausar = apagar el agente y su widget; no borra nada.
create or replace function rewards.pausar_trials_agotados()
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in
    select t.id, t.assistant_id, t.trial_started_at, t.interacciones_incluidas
    from rewards.agentes_trial t
    where t.activated_at is null
      and t.paused_at is null
    for update skip locked
  loop
    if rewards.interacciones_agente(r.assistant_id, r.trial_started_at) >= r.interacciones_incluidas then
      update public.assistants
      set is_active = false,
          widget_config = coalesce(widget_config, '{}'::jsonb) || jsonb_build_object('enabled', false)
      where id = r.assistant_id;

      update rewards.agentes_trial set paused_at = now() where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke execute on function rewards.pausar_trials_agotados() from public, anon, authenticated;
grant execute on function rewards.pausar_trials_agotados() to service_role;

-- La versión por días ya no aplica
drop function if exists rewards.pausar_trials_vencidos();

do $$
begin
  perform cron.unschedule('rewards_pausar_trials');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'rewards_pausar_trials',
  '17 * * * *',
  'select rewards.pausar_trials_agotados()'
);

-- ── Estado de las empresas del usuario, con su agente y su consumo ───────────
-- Una sola llamada para la consola: empresas del usuario + agente ligado +
-- interacciones usadas del trial. Definer porque lee public.assistants y
-- bot_escalations, que el vendedor no puede consultar directamente.
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

revoke execute on function rewards.mis_empresas_agentes() from public, anon;
grant execute on function rewards.mis_empresas_agentes() to authenticated, service_role;

notify pgrst, 'reload schema';
