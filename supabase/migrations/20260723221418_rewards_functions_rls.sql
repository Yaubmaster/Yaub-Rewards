-- Yaub Rewards · migración 2: funciones, triggers de protección, RLS y grants.

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function rewards.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from rewards.admins a
    where lower(a.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

create or replace function rewards.current_freelancer_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select f.id from rewards.freelancers f where f.user_id = (select auth.uid());
$$;

create or replace function rewards.current_empresa_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select e.id from rewards.empresas e where e.user_id = (select auth.uid());
$$;

-- ── Generación de código de vendedor (4 letras del nombre + 2 dígitos) ───────

create or replace function rewards.generar_codigo(p_nombre text)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  letras text;
  base text;
  cand text;
  n int := 0;
begin
  letras := upper(translate(coalesce(p_nombre, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
  letras := regexp_replace(letras, '[^A-Z]', '', 'g');
  if length(letras) < 4 then
    letras := rpad(coalesce(nullif(letras, ''), 'YAUB'), 4, 'X');
  end if;
  base := substr(letras, 1, 4);
  loop
    n := n + 1;
    cand := base || '-' || lpad(n::text, 2, '0');
    exit when not exists (select 1 from rewards.freelancers f where f.codigo = cand);
    if n >= 99 then
      -- prefijo saturado: variante con letra aleatoria
      base := substr(letras, 1, 3) || chr(65 + floor(random() * 26)::int);
      n := floor(random() * 90)::int;
    end if;
  end loop;
  return cand;
end;
$$;

-- ── Registro de freelancer (idempotente por user_id) ─────────────────────────

create or replace function rewards.registrar_freelancer(p_nombre text, p_telefono text default null)
returns rewards.freelancers
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row rewards.freelancers;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  select * into v_row from rewards.freelancers where user_id = v_uid;
  if found then
    return v_row;
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Nombre requerido';
  end if;
  for i in 1..5 loop
    begin
      insert into rewards.freelancers (user_id, nombre, telefono, codigo)
      values (v_uid, trim(p_nombre), nullif(trim(p_telefono), ''), rewards.generar_codigo(p_nombre))
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      select * into v_row from rewards.freelancers where user_id = v_uid;
      if found then
        return v_row;
      end if;
    end;
  end loop;
  raise exception 'No se pudo generar un código único, intenta de nuevo';
end;
$$;

-- ── Registro de empresa (queda en_revision) con su primera oferta ────────────

create or replace function rewards.registrar_empresa(
  p_nombre text,
  p_descripcion text default null,
  p_producto text default null,
  p_comision_mxn numeric default 0,
  p_condicion text default null,
  p_capacitacion rewards.capacitacion_tipo default 'ninguna'
)
returns rewards.empresas
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row rewards.empresas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  select * into v_row from rewards.empresas where user_id = v_uid;
  if found then
    return v_row;
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Nombre requerido';
  end if;
  insert into rewards.empresas (user_id, nombre, descripcion)
  values (v_uid, trim(p_nombre), nullif(trim(p_descripcion), ''))
  returning * into v_row;
  if coalesce(trim(p_producto), '') <> '' then
    insert into rewards.ofertas (empresa_id, producto, comision_mxn, condicion_liberacion, capacitacion, activa)
    values (v_row.id, trim(p_producto), coalesce(p_comision_mxn, 0), nullif(trim(p_condicion), ''), coalesce(p_capacitacion, 'ninguna'), true);
  end if;
  return v_row;
end;
$$;

-- ── Admin: aprobar empresa y marcar pago ─────────────────────────────────────

create or replace function rewards.aprobar_empresa(p_empresa_id uuid)
returns rewards.empresas
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_row rewards.empresas;
begin
  if not rewards.is_admin() then
    raise exception 'Solo administradores';
  end if;
  update rewards.empresas set estado = 'autorizada' where id = p_empresa_id
  returning * into v_row;
  if not found then
    raise exception 'Empresa no encontrada';
  end if;
  return v_row;
end;
$$;

create or replace function rewards.marcar_pago(
  p_freelancer_id uuid,
  p_metodo text default 'transferencia',
  p_notas text default null
)
returns rewards.pagos
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_n int;
  v_row rewards.pagos;
begin
  if not rewards.is_admin() then
    raise exception 'Solo administradores';
  end if;
  with upd as (
    update rewards.referidos
    set estatus = 'pagado'
    where freelancer_id = p_freelancer_id and estatus = 'liberado'
    returning monto_mxn
  )
  select coalesce(sum(monto_mxn), 0), count(*) into v_total, v_n from upd;
  if v_n = 0 then
    raise exception 'Este freelancer no tiene comisiones liberadas por pagar';
  end if;
  insert into rewards.pagos (freelancer_id, monto_mxn, metodo, notas)
  values (p_freelancer_id, v_total, coalesce(p_metodo, 'transferencia'), p_notas)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Triggers de protección de campos sensibles ───────────────────────────────

create or replace function rewards.protege_freelancers()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- usuarios autenticados (no admin) no pueden cambiar código/activo/user_id;
  -- service_role y migraciones (auth.uid() null) pasan sin restricción
  if (select auth.uid()) is not null and not rewards.is_admin() then
    if new.codigo is distinct from old.codigo
       or new.user_id is distinct from old.user_id
       or new.activo is distinct from old.activo then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_freelancers
before update on rewards.freelancers
for each row execute function rewards.protege_freelancers();

create or replace function rewards.protege_empresas()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not rewards.is_admin() then
    if new.estado is distinct from old.estado
       or new.user_id is distinct from old.user_id then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_empresas
before update on rewards.empresas
for each row execute function rewards.protege_empresas();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table rewards.freelancers enable row level security;
alter table rewards.empresas enable row level security;
alter table rewards.ofertas enable row level security;
alter table rewards.suscripciones enable row level security;
alter table rewards.referidos enable row level security;
alter table rewards.pagos enable row level security;
alter table rewards.admins enable row level security;
alter table rewards.api_keys enable row level security;

-- freelancers: el propio, el admin, o las empresas a las que está suscrito
create policy freelancers_select on rewards.freelancers
for select to authenticated
using (
  user_id = (select auth.uid())
  or rewards.is_admin()
  or exists (
    select 1 from rewards.suscripciones s
    join rewards.empresas e on e.id = s.empresa_id
    where s.freelancer_id = freelancers.id and e.user_id = (select auth.uid())
  )
);

create policy freelancers_update on rewards.freelancers
for update to authenticated
using (user_id = (select auth.uid()) or rewards.is_admin())
with check (user_id = (select auth.uid()) or rewards.is_admin());

-- empresas: autorizadas visibles para todos los usuarios; la propia; admin todo
create policy empresas_select on rewards.empresas
for select to authenticated
using (
  estado = 'autorizada'
  or user_id = (select auth.uid())
  or rewards.is_admin()
);

create policy empresas_update on rewards.empresas
for update to authenticated
using (user_id = (select auth.uid()) or rewards.is_admin())
with check (user_id = (select auth.uid()) or rewards.is_admin());

-- ofertas: visibles si la empresa está autorizada o es propia; escritura solo propia/admin
create policy ofertas_select on rewards.ofertas
for select to authenticated
using (
  exists (
    select 1 from rewards.empresas e
    where e.id = ofertas.empresa_id
      and (e.estado = 'autorizada' or e.user_id = (select auth.uid()))
  )
  or rewards.is_admin()
);

create policy ofertas_insert on rewards.ofertas
for insert to authenticated
with check (
  exists (select 1 from rewards.empresas e where e.id = empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
);

create policy ofertas_update on rewards.ofertas
for update to authenticated
using (
  exists (select 1 from rewards.empresas e where e.id = ofertas.empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
)
with check (
  exists (select 1 from rewards.empresas e where e.id = empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
);

create policy ofertas_delete on rewards.ofertas
for delete to authenticated
using (
  exists (select 1 from rewards.empresas e where e.id = ofertas.empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
);

-- suscripciones: el freelancer maneja las suyas; la empresa ve las de su oferta
create policy suscripciones_select on rewards.suscripciones
for select to authenticated
using (
  freelancer_id = rewards.current_freelancer_id()
  or exists (select 1 from rewards.empresas e where e.id = suscripciones.empresa_id and e.user_id = (select auth.uid()))
  or rewards.is_admin()
);

create policy suscripciones_insert on rewards.suscripciones
for insert to authenticated
with check (
  freelancer_id = rewards.current_freelancer_id()
  and exists (select 1 from rewards.empresas e where e.id = empresa_id and e.estado = 'autorizada')
);

create policy suscripciones_update on rewards.suscripciones
for update to authenticated
using (freelancer_id = rewards.current_freelancer_id())
with check (freelancer_id = rewards.current_freelancer_id());

create policy suscripciones_delete on rewards.suscripciones
for delete to authenticated
using (freelancer_id = rewards.current_freelancer_id());

-- referidos: el freelancer ve los suyos; la empresa los de sus ofertas; admin todo.
-- Escritura solo via service_role (edge functions) o RPCs admin.
create policy referidos_select on rewards.referidos
for select to authenticated
using (
  freelancer_id = rewards.current_freelancer_id()
  or exists (
    select 1 from rewards.ofertas o
    join rewards.empresas e on e.id = o.empresa_id
    where o.id = referidos.oferta_id and e.user_id = (select auth.uid())
  )
  or rewards.is_admin()
);

-- pagos: el freelancer ve los suyos; admin todo (inserta via rewards.marcar_pago)
create policy pagos_select on rewards.pagos
for select to authenticated
using (freelancer_id = rewards.current_freelancer_id() or rewards.is_admin());

-- admins: solo visibles para admins
create policy admins_select on rewards.admins
for select to authenticated
using (rewards.is_admin());

-- api_keys: sin policies → solo service_role (bypass RLS)

-- ── Grants ───────────────────────────────────────────────────────────────────

grant usage on schema rewards to anon, authenticated, service_role;

grant select on rewards.freelancers, rewards.empresas, rewards.ofertas,
  rewards.suscripciones, rewards.referidos, rewards.pagos, rewards.admins
to authenticated;

grant update (nombre, telefono, clabe) on rewards.freelancers to authenticated;
grant update (nombre, descripcion) on rewards.empresas to authenticated;
grant insert, update, delete on rewards.ofertas to authenticated;
grant insert, update, delete on rewards.suscripciones to authenticated;

grant all on all tables in schema rewards to service_role;

alter default privileges in schema rewards grant all on tables to service_role;
alter default privileges in schema rewards grant all on sequences to service_role;

revoke execute on all functions in schema rewards from public, anon;
grant execute on all functions in schema rewards to authenticated, service_role;

-- ── Realtime: los referidos nuevos llegan en vivo al dashboard ───────────────

alter publication supabase_realtime add table rewards.referidos;
