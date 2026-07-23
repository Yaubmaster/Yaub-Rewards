-- Yaub Rewards · migración 3: exponer el schema `rewards` en la API (PostgREST)
-- y seed de la empresa Yaub Móvil con su oferta de portabilidad.

-- Exponer `rewards` junto a los schemas default de Supabase.
-- (config in-database de PostgREST; equivale a agregarlo en
--  Dashboard → Settings → API → Exposed schemas)
alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, rewards';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- Seed: admin inicial
insert into rewards.admins (email)
values ('jjpb.18@gmail.com')
on conflict (email) do nothing;

-- Seed: empresa Yaub Móvil (autorizada)
insert into rewards.empresas (nombre, descripcion, estado)
select 'Yaub Móvil', 'Portabilidades — el cliente conserva su número.', 'autorizada'
where not exists (select 1 from rewards.empresas where nombre = 'Yaub Móvil');

-- Seed: oferta de portabilidad ($100 MXN, se libera con la primera recarga)
insert into rewards.ofertas (empresa_id, producto, comision_mxn, condicion_liberacion, capacitacion, activa)
select e.id, 'Portabilidad Yaub Móvil', 100, 'primera_recarga', 'en_linea', true
from rewards.empresas e
where e.nombre = 'Yaub Móvil'
  and not exists (
    select 1 from rewards.ofertas o
    where o.empresa_id = e.id and o.producto = 'Portabilidad Yaub Móvil'
  );
