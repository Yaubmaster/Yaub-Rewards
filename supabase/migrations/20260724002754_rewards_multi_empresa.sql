-- Yaub Rewards · migración 8: multi-empresa por usuario.
-- Un usuario puede tener varias empresas en su oficina; registrar_empresa
-- acepta p_adicional para crear más allá de la primera.

alter table rewards.empresas drop constraint empresas_user_id_key;
create index empresas_user_id_idx on rewards.empresas (user_id);

-- Nueva firma (7 args): hay que tirar la anterior para no dejar un overload ambiguo
drop function rewards.registrar_empresa(text, text, text, numeric, text, rewards.capacitacion_tipo);

create or replace function rewards.registrar_empresa(
  p_nombre text,
  p_descripcion text default null,
  p_producto text default null,
  p_comision_mxn numeric default 0,
  p_condicion text default null,
  p_capacitacion rewards.capacitacion_tipo default 'ninguna',
  p_adicional boolean default false
)
returns rewards.empresas
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row rewards.empresas;
  v_estado rewards.empresa_estado;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Nombre requerido';
  end if;

  -- onboarding normal: si ya tiene empresa, regresa la primera (idempotente)
  if not p_adicional then
    select * into v_row from rewards.empresas
    where user_id = v_uid order by created_at limit 1;
    if found then
      return v_row;
    end if;
  end if;

  -- dedupe por nombre dentro de la misma cuenta
  select * into v_row from rewards.empresas
  where user_id = v_uid and lower(nombre) = lower(trim(p_nombre));
  if found then
    return v_row;
  end if;

  v_estado := case
    when rewards.contenido_sensible(concat_ws(' ', p_nombre, p_descripcion, p_producto))
      then 'en_revision'::rewards.empresa_estado
    else 'autorizada'::rewards.empresa_estado
  end;

  insert into rewards.empresas (user_id, nombre, descripcion, estado)
  values (v_uid, trim(p_nombre), nullif(trim(p_descripcion), ''), v_estado)
  returning * into v_row;

  if coalesce(trim(p_producto), '') <> '' then
    insert into rewards.ofertas (empresa_id, producto, comision_mxn, condicion_liberacion, capacitacion, activa)
    values (v_row.id, trim(p_producto), coalesce(p_comision_mxn, 0), nullif(trim(p_condicion), ''), coalesce(p_capacitacion, 'ninguna'), true);
  end if;
  return v_row;
end;
$$;

revoke execute on function rewards.registrar_empresa(text, text, text, numeric, text, rewards.capacitacion_tipo, boolean) from public, anon;
grant execute on function rewards.registrar_empresa(text, text, text, numeric, text, rewards.capacitacion_tipo, boolean) to authenticated, service_role;

-- Asignar la empresa seed Yaub Móvil a la cuenta admin (jacobopayan@yaub.ai)
update rewards.empresas e
set user_id = u.id
from auth.users u
where e.nombre = 'Yaub Móvil' and e.user_id is null
  and u.email = 'jacobopayan@yaub.ai';

notify pgrst, 'reload schema';
