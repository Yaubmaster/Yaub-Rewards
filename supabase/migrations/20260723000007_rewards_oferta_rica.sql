-- Yaub Rewards · migración 7: ofertas enriquecidas (descripción, precio, fotos)
-- y módulos de capacitación en video (YouTube) por empresa.

alter table rewards.ofertas
  add column descripcion text,
  add column precio_mxn numeric,
  add column fotos jsonb not null default '[]'::jsonb;

-- Módulos grabados: la empresa sube su video a YouTube y pega el link.
-- Los freelancers los ven en Capacitación una vez suscritos.
create table rewards.capacitacion_modulos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references rewards.empresas (id) on delete cascade,
  titulo text not null,
  youtube_url text not null,
  orden int not null default 1,
  created_at timestamptz not null default now()
);

create index capacitacion_modulos_empresa_idx on rewards.capacitacion_modulos (empresa_id);

alter table rewards.capacitacion_modulos enable row level security;

-- Ver módulos: la empresa dueña, el admin, o freelancers suscritos a esa empresa
create policy modulos_select on rewards.capacitacion_modulos
for select to authenticated
using (
  exists (select 1 from rewards.empresas e where e.id = empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
  or exists (
    select 1 from rewards.suscripciones s
    where s.empresa_id = capacitacion_modulos.empresa_id
      and s.freelancer_id = rewards.current_freelancer_id()
  )
);

-- Administrar módulos: solo la empresa dueña o admin
create policy modulos_write on rewards.capacitacion_modulos
for all to authenticated
using (
  exists (select 1 from rewards.empresas e where e.id = empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
)
with check (
  exists (select 1 from rewards.empresas e where e.id = empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
);

grant select, insert, update, delete on rewards.capacitacion_modulos to authenticated;
grant all on rewards.capacitacion_modulos to service_role;

-- Contador para el marketplace (los módulos en sí solo se ven suscrito)
create or replace function rewards.contar_modulos(p_empresa_id uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int
  from rewards.capacitacion_modulos m
  join rewards.empresas e on e.id = m.empresa_id
  where m.empresa_id = p_empresa_id and e.estado = 'autorizada';
$$;

revoke execute on function rewards.contar_modulos(uuid) from public, anon;
grant execute on function rewards.contar_modulos(uuid) to authenticated, service_role;

-- Bucket público para fotos de ofertas; cada usuario escribe solo en su carpeta
insert into storage.buckets (id, name, public)
values ('rewards-fotos', 'rewards-fotos', true)
on conflict (id) do nothing;

create policy rewards_fotos_select on storage.objects
for select to public
using (bucket_id = 'rewards-fotos');

create policy rewards_fotos_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'rewards-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy rewards_fotos_delete on storage.objects
for delete to authenticated
using (bucket_id = 'rewards-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
