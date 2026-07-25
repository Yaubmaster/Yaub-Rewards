-- Yaub Rewards · pruebas de "Mis ofertas" (favoritas) y de las fotos de perfil.
--
-- Corre entero contra la base y NO deja rastro: termina con una excepción a
-- propósito para que Postgres revierta todo. Si algo falla, el mensaje empieza
-- con FALLO en vez de ROLLBACK_DE_PRUEBA.
--
--   psql "$DATABASE_URL" -f supabase/tests/favoritas_y_avatares_test.sql
--
-- Lo que prueba:
--   1. Un vendedor puede guardar una oferta de un agente al que ESTÁ suscrito.
--   2. NO puede guardar una de un agente al que no está suscrito.
--   3. NO puede guardar favoritas a nombre de otro vendedor.
--   4. La favorita sale marcada en `ofertas_publicadas()`.
--   5. La puede quitar.
--   6. El dueño de una cuenta Yaub puede cambiar el logo del tenant y la foto
--      del agente; un usuario ajeno no.

do $$
declare
  v_fl    uuid;   -- vendedor con al menos una suscripción
  v_uid   uuid;
  v_ok    uuid;   -- oferta de un agente suscrito
  v_no    uuid;   -- oferta de un agente NO suscrito
  v_otro  uuid;   -- otro vendedor
  v_n     int;
begin
  select s.freelancer_id, f.user_id into v_fl, v_uid
  from rewards.suscripciones s
  join rewards.freelancers f on f.id = s.freelancer_id
  join rewards.ofertas o on o.empresa_id = s.empresa_id and o.estado = 'publicada'
  limit 1;
  if v_fl is null then
    raise notice 'SALTADO: no hay ningún vendedor suscrito con ofertas publicadas';
    return;
  end if;
  select id into v_otro from rewards.freelancers where id <> v_fl limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  select o.id into v_ok
  from rewards.ofertas o
  join rewards.suscripciones s on s.empresa_id = o.empresa_id and s.freelancer_id = v_fl
  where o.estado = 'publicada' limit 1;

  select o.id into v_no
  from rewards.ofertas o
  where o.estado = 'publicada'
    and not exists (
      select 1 from rewards.suscripciones s
      where s.empresa_id = o.empresa_id and s.freelancer_id = v_fl
    ) limit 1;

  -- 1
  insert into rewards.ofertas_favoritas(freelancer_id, oferta_id) values (v_fl, v_ok);
  raise notice 'OK  1. guarda la oferta de un agente suscrito';

  -- 2
  if v_no is not null then
    begin
      insert into rewards.ofertas_favoritas(freelancer_id, oferta_id) values (v_fl, v_no);
      raise exception 'FALLO 2: dejó guardar una oferta SIN suscripción';
    exception when insufficient_privilege or check_violation then
      raise notice 'OK  2. bloquea la oferta sin suscripción';
    end;
  end if;

  -- 3
  if v_otro is not null then
    begin
      insert into rewards.ofertas_favoritas(freelancer_id, oferta_id) values (v_otro, v_ok);
      raise exception 'FALLO 3: dejó guardar una favorita a nombre de otro vendedor';
    exception when insufficient_privilege or check_violation then
      raise notice 'OK  3. bloquea la favorita a nombre de otro';
    end;
  end if;

  -- 4
  select count(*) into v_n
  from jsonb_array_elements(rewards.ofertas_publicadas()) e
  where (e->>'oferta_id')::uuid = v_ok and (e->>'favorita')::boolean;
  if v_n <> 1 then raise exception 'FALLO 4: la favorita no sale marcada en el marketplace'; end if;
  raise notice 'OK  4. sale marcada en el marketplace';

  -- 5
  delete from rewards.ofertas_favoritas where freelancer_id = v_fl and oferta_id = v_ok;
  raise notice 'OK  5. se puede quitar';

  raise exception 'ROLLBACK_DE_PRUEBA';
end $$;

do $$
declare
  v_owner  uuid;
  v_ajeno  uuid;
  v_tenant uuid;
  v_assist uuid;
  v_n      int;
begin
  -- Dueño de una cuenta con agentes, y alguien sin ninguna relación con ella
  select au.auth_user_id, au.tenant_id into v_owner, v_tenant
  from public.app_users au
  where au.tenant_id is not null
    and au.role in ('OWNER', 'BUSINESS_OWNER')
    and exists (select 1 from public.assistants a where a.tenant_id = au.tenant_id and a.archived_at is null)
  limit 1;
  if v_owner is null then
    raise notice 'SALTADO: no hay ninguna cuenta con dueño y agentes';
    return;
  end if;

  select a.id into v_assist
  from public.assistants a where a.tenant_id = v_tenant and a.archived_at is null limit 1;

  select au.auth_user_id into v_ajeno
  from public.app_users au
  where au.tenant_id is distinct from v_tenant
    and not exists (
      select 1 from public.user_tenant_memberships m
      where m.app_user_id = au.id and m.tenant_id = v_tenant and m.is_active
    )
  limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 6a. el dueño sí puede
  perform rewards.guardar_avatar_tenant(v_tenant, 'https://ejemplo.test/logo.png');
  raise notice 'OK  6a. el dueño cambia el logo de su cuenta';
  perform rewards.guardar_avatar_agente(v_assist, 'https://ejemplo.test/agente.png');
  raise notice 'OK  6b. el dueño cambia la foto de su agente';

  select jsonb_array_length(rewards.mis_tenants()) into v_n;
  if v_n = 0 then raise exception 'FALLO 6c: el dueño no ve ninguna cuenta en mis_tenants()'; end if;
  raise notice 'OK  6c. mis_tenants() le devuelve % cuenta(s)', v_n;

  -- 6d. el ajeno no
  if v_ajeno is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_ajeno, 'role', 'authenticated')::text, true);
    begin
      perform rewards.guardar_avatar_tenant(v_tenant, 'https://malo.test/x.png');
      raise exception 'FALLO 6d: un usuario ajeno cambió el logo del tenant';
    exception when raise_exception then
      if sqlerrm like 'FALLO%' then raise; end if;
      raise notice 'OK  6d. el usuario ajeno queda bloqueado en el tenant';
    end;
    begin
      perform rewards.guardar_avatar_agente(v_assist, 'https://malo.test/x.png');
      raise exception 'FALLO 6e: un usuario ajeno cambió la foto del agente';
    exception when raise_exception then
      if sqlerrm like 'FALLO%' then raise; end if;
      raise notice 'OK  6e. el usuario ajeno queda bloqueado en el agente';
    end;
  end if;

  raise exception 'ROLLBACK_DE_PRUEBA';
end $$;
