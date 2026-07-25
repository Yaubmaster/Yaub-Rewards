-- Yaub Rewards · Consola "Agentes Yaub Conectados" (Feature 2).
-- Trial de 7 días por agente como EXTENSIÓN de rewards: no toca assistant_billing
-- ni el schema de public. Al vencer, el agente se pausa (no se borra).

create table if not exists rewards.agentes_trial (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null unique references public.assistants(id) on delete cascade,
  empresa_id uuid not null references rewards.empresas(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '7 days',
  paused_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agentes_trial_empresa_idx on rewards.agentes_trial (empresa_id);

alter table rewards.agentes_trial enable row level security;

-- La empresa dueña ve sus trials; admin todo. Escritura solo service_role / definer.
create policy agentes_trial_select on rewards.agentes_trial
for select to authenticated
using (
  exists (
    select 1 from rewards.empresas e
    where e.id = agentes_trial.empresa_id and e.user_id = (select auth.uid())
  )
  or rewards.is_admin()
);

grant select on rewards.agentes_trial to authenticated;

-- ── Pausa automática de trials vencidos (pg_cron, cada hora) ─────────────────
-- Pausar = assistants.is_active=false + widget_config.enabled=false (apaga el
-- chat web). No borra nada; activar con Yaub lo revierte.
create or replace function rewards.pausar_trials_vencidos()
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in
    select t.id, t.assistant_id
    from rewards.agentes_trial t
    where t.activated_at is null
      and t.paused_at is null
      and t.trial_ends_at < now()
    for update skip locked
  loop
    update public.assistants
    set is_active = false,
        widget_config = coalesce(widget_config, '{}'::jsonb) || jsonb_build_object('enabled', false)
    where id = r.assistant_id;

    update rewards.agentes_trial set paused_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Solo cron (postgres) y service_role; ningún usuario final la ejecuta.
revoke execute on function rewards.pausar_trials_vencidos() from public, anon, authenticated;
grant execute on function rewards.pausar_trials_vencidos() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'rewards_pausar_trials') then
    perform cron.schedule('rewards_pausar_trials', '17 * * * *', 'select rewards.pausar_trials_vencidos()');
  end if;
end;
$$;

-- ── Admin: activar un agente (post-trial o durante) ──────────────────────────
create or replace function rewards.activar_agente(p_assistant_id uuid)
returns rewards.agentes_trial
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_row rewards.agentes_trial;
begin
  if not rewards.is_admin() then
    raise exception 'Solo administradores';
  end if;

  update rewards.agentes_trial
  set activated_at = now(), paused_at = null
  where assistant_id = p_assistant_id
  returning * into v_row;
  if not found then
    raise exception 'Agente sin trial de Rewards';
  end if;

  update public.assistants
  set is_active = true,
      widget_config = coalesce(widget_config, '{}'::jsonb) || jsonb_build_object('enabled', true)
  where id = p_assistant_id;

  return v_row;
end;
$$;

revoke execute on function rewards.activar_agente(uuid) from public, anon;
grant execute on function rewards.activar_agente(uuid) to authenticated, service_role;

-- ── Storage para documentos/imágenes de contexto de agentes ──────────────────
insert into storage.buckets (id, name, public)
values ('rewards-agentes', 'rewards-agentes', true)
on conflict (id) do nothing;

create policy rewards_agentes_select on storage.objects
for select to public
using (bucket_id = 'rewards-agentes');

create policy rewards_agentes_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'rewards-agentes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy rewards_agentes_delete on storage.objects
for delete to authenticated
using (bucket_id = 'rewards-agentes' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
