-- Los triggers de proteccion bloqueaban el ON DELETE SET NULL de user_id cuando
-- yaub-platform elimina un usuario (el UPDATE en cascada corre con el auth.uid()
-- del caller, que no es admin de Rewards). La RPC delete_user_by_owner activa un
-- flag local de transaccion que estos triggers respetan.
CREATE OR REPLACE FUNCTION rewards.protege_freelancers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  -- bypass: borrado de usuario desde yaub-platform (flag local a la transaccion)
  if coalesce(current_setting('yaub.platform_user_delete', true), '') = '1' then
    return new;
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION rewards.protege_empresas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  if coalesce(current_setting('yaub.platform_user_delete', true), '') = '1' then
    return new;
  end if;
  if (select auth.uid()) is not null and not rewards.is_admin() then
    if new.estado is distinct from old.estado
       or new.user_id is distinct from old.user_id then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$function$;
