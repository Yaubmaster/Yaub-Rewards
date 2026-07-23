-- Yaub Rewards · migración 4: RPC para que la empresa dueña de la oferta
-- (o un admin) marque la condición cumplida y libere la comisión desde el panel.

create or replace function rewards.liberar_referido(
  p_referido_id uuid,
  p_evento text default 'condicion_cumplida'
)
returns rewards.referidos
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_row rewards.referidos;
  v_autorizado boolean;
begin
  select exists (
    select 1
    from rewards.referidos r
    join rewards.ofertas o on o.id = r.oferta_id
    join rewards.empresas e on e.id = o.empresa_id
    where r.id = p_referido_id and e.user_id = (select auth.uid())
  ) or rewards.is_admin() into v_autorizado;

  if not v_autorizado then
    raise exception 'No autorizado para liberar este referido';
  end if;

  update rewards.referidos
  set estatus = 'liberado',
      liberado_at = now(),
      evento_liberacion = coalesce(nullif(trim(p_evento), ''), 'condicion_cumplida')
  where id = p_referido_id and estatus = 'pendiente'
  returning * into v_row;

  if not found then
    -- idempotente: si ya estaba liberado/pagado, regresa el row tal cual
    select * into v_row from rewards.referidos where id = p_referido_id;
    if not found then
      raise exception 'Referido no encontrado';
    end if;
  end if;
  return v_row;
end;
$$;

revoke execute on function rewards.liberar_referido(uuid, text) from public, anon;
grant execute on function rewards.liberar_referido(uuid, text) to authenticated, service_role;
notify pgrst, 'reload schema';
