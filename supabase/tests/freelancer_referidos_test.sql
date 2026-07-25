-- Test transaccional de la regla de referidos de vendedores (Feature 3).
-- Corre TODO dentro de BEGIN…ROLLBACK: no deja rastro en la base.
-- Cómo correrlo:  psql "$DATABASE_URL" -f supabase/tests/freelancer_referidos_test.sql
-- (o pegar el archivo completo en el SQL editor / execute_sql de Supabase).
-- Pasa si la última fila del NOTICE dice: TODOS LOS ASSERTS PASARON.

begin;

do $test$
declare
  v_uid_ref uuid := gen_random_uuid();   -- referrer
  v_uid_new uuid := gen_random_uuid();   -- vendedor nuevo (referido)
  v_uid_x   uuid := gen_random_uuid();   -- tercero para casos de error
  v_ref rewards.freelancers;
  v_new rewards.freelancers;
  v_bono rewards.freelancer_referidos;
  v_emp_id uuid;
  v_of_id uuid;
  v_r1 uuid; v_r2 uuid; v_r3 uuid;
  v_pago rewards.pagos;
  v_cnt int;
  v_liberado_at timestamptz;
  v_err text;
begin
  -- ── setup: cuentas auth + admin temporal ───────────────────────────────────
  -- app_user_id dummy = mismo marcador que usa crear-cuenta-rewards para que el
  -- trigger de plataforma no provisione tenants (igual todo se revierte).
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_uid_ref, 'zz-referrer@test.rewards', '{"app_user_id":"00000000-0000-0000-0000-000000000000"}'),
    (v_uid_new, 'zz-nuevo@test.rewards',    '{"app_user_id":"00000000-0000-0000-0000-000000000000"}'),
    (v_uid_x,   'zz-x@test.rewards',        '{"app_user_id":"00000000-0000-0000-0000-000000000000"}');
  insert into rewards.admins (email) values ('zz-admin@test.rewards');

  -- ── alta del referrer ──────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_ref, 'email', 'zz-referrer@test.rewards', 'role', 'authenticated')::text, true);
  v_ref := rewards.registrar_freelancer('Zyxwvut Referrer');
  if v_ref.codigo is null then raise exception 'FALLO: referrer sin codigo'; end if;

  -- ── validar_codigo_vendedor ────────────────────────────────────────────────
  if (rewards.validar_codigo_vendedor(v_ref.codigo)->>'valido')::boolean is not true then
    raise exception 'FALLO: codigo valido reportado como invalido';
  end if;
  if (rewards.validar_codigo_vendedor('NOPE-99')->>'valido')::boolean is not false then
    raise exception 'FALLO: codigo inexistente reportado como valido';
  end if;

  -- ── alta del nuevo con código válido → bono pendiente inmediato ────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_new, 'email', 'zz-nuevo@test.rewards', 'role', 'authenticated')::text, true);
  v_new := rewards.registrar_freelancer('Zyxwvut Nuevo', null, lower(v_ref.codigo));  -- case-insensitive

  select * into v_bono from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if not found then raise exception 'FALLO: no se creo el bono de referido'; end if;
  if v_bono.estatus <> 'pendiente' then raise exception 'FALLO: bono no nace pendiente'; end if;
  if v_bono.monto_referido_mxn <> 50 or v_bono.monto_referrer_mxn <> 100 then
    raise exception 'FALLO: montos incorrectos (%/%)', v_bono.monto_referido_mxn, v_bono.monto_referrer_mxn;
  end if;

  -- ── anti-abuso: código inválido rechaza el alta ────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_x, 'email', 'zz-x@test.rewards', 'role', 'authenticated')::text, true);
  begin
    perform rewards.registrar_freelancer('Zyxwvut Equis', null, 'NOPE-99');
    raise exception 'FALLO: codigo invalido no fue rechazado';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'codigo_invalido' then raise; end if;
  end;

  -- ── anti-abuso: solo se puede ser referido una vez (alta idempotente) ──────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_new, 'email', 'zz-nuevo@test.rewards', 'role', 'authenticated')::text, true);
  perform rewards.registrar_freelancer('Zyxwvut Nuevo', null, v_ref.codigo);
  select count(*) into v_cnt from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_cnt <> 1 then raise exception 'FALLO: referido duplicado (%)', v_cnt; end if;

  -- ── empresa + oferta + 3 comisiones del vendedor nuevo ─────────────────────
  insert into rewards.empresas (user_id, nombre, estado) values (v_uid_x, 'Zyx Empresa Test', 'autorizada') returning id into v_emp_id;
  insert into rewards.ofertas (empresa_id, producto, comision_mxn) values (v_emp_id, 'Producto Test', 100) returning id into v_of_id;
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus)
    values (v_new.codigo, v_new.id, v_of_id, '8110000001', 100, 'liberado') returning id into v_r1;
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus)
    values (v_new.codigo, v_new.id, v_of_id, '8110000002', 100, 'liberado') returning id into v_r2;
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus)
    values (v_new.codigo, v_new.id, v_of_id, '8110000003', 100, 'pendiente') returning id into v_r3;

  -- ── cobro 1 y 2 (como admin): el bono NO se libera todavía ─────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_x, 'email', 'zz-admin@test.rewards', 'role', 'authenticated')::text, true);

  update rewards.referidos set estatus = 'pagado' where id = v_r1;  -- 1ª comisión cobrada
  select * into v_bono from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_bono.estatus <> 'pendiente' then raise exception 'FALLO: bono liberado con 1 comision'; end if;

  update rewards.referidos set estatus = 'pagado' where id = v_r2;  -- 2ª comisión cobrada
  select * into v_bono from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_bono.estatus <> 'pendiente' then raise exception 'FALLO: bono liberado con 2 comisiones'; end if;

  -- ── cobro 3 vía marcar_pago: libera el bono EN ESE EVENTO y lo incluye ─────
  update rewards.referidos set estatus = 'liberado' where id = v_r3;
  v_pago := rewards.marcar_pago(v_new.id, 'transferencia', 'corte test');

  select * into v_bono from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_bono.estatus <> 'liberado' then raise exception 'FALLO: bono NO se libero con la 3a comision'; end if;
  if v_bono.liberado_at is null or v_bono.referido_disparador_id is distinct from v_r3 then
    raise exception 'FALLO: metadata de liberacion incompleta';
  end if;
  -- el mismo corte de la 3ª comisión ya incluye los $50 del nuevo
  if v_pago.monto_mxn <> 150 then
    raise exception 'FALLO: corte 3 debia ser 100 + 50 de bono, fue %', v_pago.monto_mxn;
  end if;
  if v_bono.referido_pagado_at is null then raise exception 'FALLO: lado referido no quedo pagado'; end if;
  v_liberado_at := v_bono.liberado_at;

  -- ── idempotencia: repetir el evento no duplica ni re-libera ────────────────
  update rewards.referidos set estatus = 'liberado' where id = v_r3;
  update rewards.referidos set estatus = 'pagado'  where id = v_r3;  -- re-disparo del trigger
  select * into v_bono from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_bono.liberado_at is distinct from v_liberado_at then
    raise exception 'FALLO: re-disparo cambio la liberacion (no idempotente)';
  end if;
  select count(*) into v_cnt from rewards.freelancer_referidos where referred_freelancer_id = v_new.id;
  if v_cnt <> 1 then raise exception 'FALLO: filas duplicadas tras re-disparo'; end if;

  -- marcar_pago de nuevo para el vendedor nuevo: ya no hay nada → excepción
  begin
    perform rewards.marcar_pago(v_new.id);
    raise exception 'FALLO: doble pago al vendedor nuevo';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%no tiene comisiones liberadas%' then raise; end if;
  end;

  -- ── el referrer cobra sus $100 una sola vez ────────────────────────────────
  v_pago := rewards.marcar_pago(v_ref.id, 'transferencia', 'bono referido');
  if v_pago.monto_mxn <> 100 then
    raise exception 'FALLO: pago al referrer debia ser 100, fue %', v_pago.monto_mxn;
  end if;
  begin
    perform rewards.marcar_pago(v_ref.id);
    raise exception 'FALLO: doble pago al referrer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%no tiene comisiones liberadas%' then raise; end if;
  end;

  -- ── resumen gamificado ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_ref, 'email', 'zz-referrer@test.rewards', 'role', 'authenticated')::text, true);
  if (rewards.mis_referidos_resumen()->'como_referrer'->0->>'comisiones_pagadas')::int <> 3 then
    raise exception 'FALLO: resumen del referrer no marca 3/3';
  end if;

  raise notice 'TODOS LOS ASSERTS PASARON ✔ (rollback a continuación, cero residuos)';
end;
$test$;

rollback;
