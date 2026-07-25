-- Yaub Rewards · ofertas favoritas del vendedor + fotos de perfil.
--
-- Favoritas: una vez suscrito a un agente, el vendedor puede guardar ofertas
-- sueltas de distintos agentes y verlas juntas en "Mis ofertas".
-- Fotos: el tenant y el agente ya tienen dónde guardarlas en la plataforma
-- (tenants.logo_url, assistants.avatar_url); al vendedor se le agrega la suya.

create table if not exists rewards.ofertas_favoritas (
  freelancer_id uuid not null references rewards.freelancers(id) on delete cascade,
  oferta_id uuid not null references rewards.ofertas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (freelancer_id, oferta_id)
);

alter table rewards.ofertas_favoritas enable row level security;

drop policy if exists favoritas_select on rewards.ofertas_favoritas;
create policy favoritas_select on rewards.ofertas_favoritas
for select to authenticated
using (freelancer_id = rewards.current_freelancer_id());

drop policy if exists favoritas_insert on rewards.ofertas_favoritas;
create policy favoritas_insert on rewards.ofertas_favoritas
for insert to authenticated
with check (
  freelancer_id = rewards.current_freelancer_id()
  -- solo puede guardar ofertas de agentes a los que ya está suscrito
  and exists (
    select 1 from rewards.ofertas o
    join rewards.suscripciones s on s.empresa_id = o.empresa_id
    where o.id = oferta_id and s.freelancer_id = rewards.current_freelancer_id()
  )
);

drop policy if exists favoritas_delete on rewards.ofertas_favoritas;
create policy favoritas_delete on rewards.ofertas_favoritas
for delete to authenticated
using (freelancer_id = rewards.current_freelancer_id());

grant select, insert, delete on rewards.ofertas_favoritas to authenticated;

-- Foto de perfil del vendedor
alter table rewards.freelancers add column if not exists avatar_url text;
grant update (nombre, telefono, clabe, avatar_url) on rewards.freelancers to authenticated;

-- Bucket compartido para avatares (tenant, agente y vendedor)
insert into storage.buckets (id, name, public)
values ('rewards-avatares', 'rewards-avatares', true)
on conflict (id) do nothing;

drop policy if exists rewards_avatares_select on storage.objects;
create policy rewards_avatares_select on storage.objects
for select to public using (bucket_id = 'rewards-avatares');

drop policy if exists rewards_avatares_insert on storage.objects;
create policy rewards_avatares_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'rewards-avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists rewards_avatares_update on storage.objects;
create policy rewards_avatares_update on storage.objects
for update to authenticated
using (bucket_id = 'rewards-avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists rewards_avatares_delete on storage.objects;
create policy rewards_avatares_delete on storage.objects
for delete to authenticated
using (bucket_id = 'rewards-avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── Marketplace: ahora con avatares, fotos y si es favorita ─────────────────
create or replace function rewards.ofertas_publicadas()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'publicado_por', x->>'empresa'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'oferta_id', o.id, 'producto', o.producto, 'descripcion', o.descripcion,
      'comision_mxn', o.comision_mxn, 'precio_mxn', o.precio_mxn,
      'condicion', o.condicion_liberacion, 'capacitacion', o.capacitacion::text,
      'fotos', o.fotos, 'creada', o.created_at,
      'empresa_id', e.id, 'empresa', e.nombre, 'assistant_id', e.assistant_id,
      'agente', a.name,
      'agente_avatar', a.avatar_url,
      'tenant_id', e.tenant_id,
      'publicado_por', coalesce(t.name, e.nombre),
      'tenant_avatar', coalesce(t.logo_url, t.logo_url_light),
      'canales', case when a.id is null then '[]'::jsonb else
        coalesce(a.channels, '[]'::jsonb)
        || case when a.whatsapp_phone_number is not null then '["whatsapp"]'::jsonb else '[]'::jsonb end
        || case when a.widget_public_key is not null then '["web"]'::jsonb else '[]'::jsonb end
      end,
      'agente_activo', coalesce(a.is_active, false),
      'suscrito', exists (
        select 1 from rewards.suscripciones s
        where s.empresa_id = e.id and s.freelancer_id = rewards.current_freelancer_id()
      ),
      'favorita', exists (
        select 1 from rewards.ofertas_favoritas f
        where f.oferta_id = o.id and f.freelancer_id = rewards.current_freelancer_id()
      )
    ) as x
    from rewards.ofertas o
    join rewards.empresas e on e.id = o.empresa_id
    left join public.assistants a on a.id = e.assistant_id
    left join public.tenants t on t.id = e.tenant_id
    where o.estado = 'publicada' and e.estado = 'autorizada'
  ) s;
$$;

revoke execute on function rewards.ofertas_publicadas() from public, anon;
grant execute on function rewards.ofertas_publicadas() to authenticated, service_role;

-- Guardar la foto del agente desde Rewards (RLS de la plataforma decide)
create or replace function rewards.guardar_avatar_agente(p_assistant_id uuid, p_url text)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare v_n int;
begin
  update public.assistants set avatar_url = nullif(btrim(p_url), '') where id = p_assistant_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No tienes permiso para editar este agente';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function rewards.guardar_avatar_agente(uuid, text) from public, anon;
grant execute on function rewards.guardar_avatar_agente(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
