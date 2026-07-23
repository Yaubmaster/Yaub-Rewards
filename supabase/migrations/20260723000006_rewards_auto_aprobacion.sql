-- Yaub Rewards · migración 6: auto-aprobación de empresas con filtro rápido
-- de contenido sensible. Si el nombre/descr./producto pasan el filtro, la
-- empresa queda 'autorizada' al instante; si no, cae a revisión manual (/admin).

create or replace function rewards.contenido_sensible(p_texto text)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(array[
      'porno','pornografia','sexo','sexual','sexuales','escort','escorts','xxx','onlyfans','fetiche',
      'droga','drogas','marihuana','mariguana','cannabis','cocaina','fentanilo','metanfetamina','cristal',
      'arma','armas','pistola','pistolas','rifle','rifles','municion','municiones','explosivo','explosivos',
      'casino','apuesta','apuestas','apostar',
      'fraude','estafa','piramide','piramidal','lavado',
      'hackeo','hackear','malware','phishing',
      'tabaco','cigarros','vape','vapeo'
    ]) as w(palabra)
    where lower(public.unaccent('public.unaccent'::regdictionary, coalesce(p_texto, ''))) ~ ('\m' || w.palabra || '\M')
  );
$$;

-- registrar_empresa ahora decide el estado con el filtro
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
  v_estado rewards.empresa_estado;
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

revoke execute on function rewards.contenido_sensible(text) from public, anon;
grant execute on function rewards.contenido_sensible(text) to authenticated, service_role;

-- Re-evalúa las empresas que quedaron en revisión con el filtro nuevo
update rewards.empresas e
set estado = 'autorizada'
where e.estado = 'en_revision'
  and not rewards.contenido_sensible(
    concat_ws(' ', e.nombre, e.descripcion,
      (select string_agg(o.producto, ' ') from rewards.ofertas o where o.empresa_id = e.id))
  );

notify pgrst, 'reload schema';
