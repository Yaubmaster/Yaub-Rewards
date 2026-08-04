-- Test transaccional del leaderboard por temporada y del fix de pausar oferta.
-- Corre TODO dentro de BEGIN…ROLLBACK: no deja rastro en la base.
-- Cómo correrlo:  psql "$DATABASE_URL" -f supabase/tests/leaderboard_temporadas_test.sql
-- (o pegar el archivo completo en el SQL editor / execute_sql de Supabase).
-- Pasa si la última fila del NOTICE dice: TODOS LOS ASSERTS PASARON.
--
-- Las fechas nunca se escriben a mano: se derivan de rewards.temporada_inicio()
-- para que el test valga en cualquier trimestre y no pelee con la zona horaria.

begin;

do $test$
declare
  v_uid_a uuid := gen_random_uuid();   -- Ana  · 4 ventas
  v_uid_b uuid := gen_random_uuid();   -- Beto · 3 ventas (empata con Carla)
  v_uid_c uuid := gen_random_uuid();   -- Carla· 3 ventas, cerradas después
  v_uid_d uuid := gen_random_uuid();   -- Diego· 0 esta temporada, 2 la pasada
  v_a rewards.freelancers;
  v_b rewards.freelancers;
  v_c rewards.freelancers;
  v_d rewards.freelancers;
  v_emp_id uuid;
  v_of_id uuid;
  v_hoy text := rewards.temporada_de(now());
  v_previa text;
  v_ini timestamptz;
  v_ini_previa timestamptz;
  v_lb jsonb;
  v_fila jsonb;
  v_err text;
  v_n int;
begin
  v_ini := rewards.temporada_inicio(v_hoy);
  v_previa := rewards.temporada_de(v_ini - interval '1 day');
  v_ini_previa := rewards.temporada_inicio(v_previa);

  -- ── setup: cuentas auth (app_user_id dummy = no provisiona tenants) ────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_uid_a, 'zz-lb-ana@test.rewards',   '{"app_user_id":"00000000-0000-0000-0000-000000000000"}'),
    (v_uid_b, 'zz-lb-beto@test.rewards',  '{"app_user_id":"00000000-0000-0000-0000-000000000000"}'),
    (v_uid_c, 'zz-lb-carla@test.rewards', '{"app_user_id":"00000000-0000-0000-0000-000000000000"}'),
    (v_uid_d, 'zz-lb-diego@test.rewards', '{"app_user_id":"00000000-0000-0000-0000-000000000000"}');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_a, 'email', 'zz-lb-ana@test.rewards', 'role', 'authenticated')::text, true);
  v_a := rewards.registrar_freelancer('Zz Lbana');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_b, 'email', 'zz-lb-beto@test.rewards', 'role', 'authenticated')::text, true);
  v_b := rewards.registrar_freelancer('Zz Lbbeto');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_c, 'email', 'zz-lb-carla@test.rewards', 'role', 'authenticated')::text, true);
  v_c := rewards.registrar_freelancer('Zz Lbcarla');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_d, 'email', 'zz-lb-diego@test.rewards', 'role', 'authenticated')::text, true);
  v_d := rewards.registrar_freelancer('Zz Lbdiego');

  -- empresa + oferta como migración (sin jwt) para saltarse RLS
  perform set_config('request.jwt.claims', null, true);
  insert into rewards.empresas (nombre, estado) values ('Zz Lb Empresa', 'autorizada') returning id into v_emp_id;
  insert into rewards.ofertas (empresa_id, producto, comision_mxn)
  values (v_emp_id, 'Zz Lb Producto', 100) returning id into v_of_id;

  -- ── ventas: siempre a media temporada, nunca en el filo ───────────────────
  -- Ana: 4 cerradas. Beto: 3 cerradas antes que Carla. Carla: 3 cerradas después.
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at, liberado_at)
  select v_a.codigo, v_a.id, v_of_id, '551000000' || g, 100, 'liberado',
         v_ini + interval '10 days', v_ini + interval '20 days'
  from generate_series(1, 4) g;

  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at, liberado_at)
  select v_b.codigo, v_b.id, v_of_id, '552000000' || g, 100, 'pagado',
         v_ini + interval '10 days', v_ini + interval '15 days'
  from generate_series(1, 3) g;

  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at, liberado_at)
  select v_c.codigo, v_c.id, v_of_id, '553000000' || g, 100, 'liberado',
         v_ini + interval '10 days', v_ini + interval '30 days'
  from generate_series(1, 3) g;

  -- Diego: 2 pendientes esta temporada (no rankean) y 2 cerradas la pasada
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at)
  select v_d.codigo, v_d.id, v_of_id, '554000000' || g, 100, 'pendiente', v_ini + interval '25 days'
  from generate_series(1, 2) g;

  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at, liberado_at)
  select v_d.codigo, v_d.id, v_of_id, '555000000' || g, 100, 'pagado',
         v_ini_previa + interval '10 days', v_ini_previa + interval '20 days'
  from generate_series(1, 2) g;

  -- Capturada la temporada pasada pero CERRADA en esta: cuenta en esta.
  insert into rewards.referidos (codigo, freelancer_id, oferta_id, cliente_telefono, monto_mxn, estatus, created_at, liberado_at)
  values (v_a.codigo, v_a.id, v_of_id, '5569999999', 100, 'liberado',
          v_ini_previa + interval '40 days', v_ini + interval '40 days');

  -- ── 1. Tabla de la temporada en curso, vista por Carla ────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_c, 'email', 'zz-lb-carla@test.rewards', 'role', 'authenticated')::text, true);
  v_lb := rewards.leaderboard_ventas(v_hoy, 200);

  -- Ana lidera con 5 (4 + la que capturó la temporada pasada y cerró en esta)
  select f into v_fila from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbana';
  if (v_fila->>'ventas')::int <> 5 then
    raise exception 'FALLO: Ana debería tener 5 ventas (la cerrada en esta temporada cuenta aquí), trae %', v_fila->>'ventas';
  end if;
  if (v_fila->>'posicion')::int <> 1 then
    raise exception 'FALLO: Ana no va en la posición 1, va en %', v_fila->>'posicion';
  end if;

  -- Empate: Beto y Carla comparten posición 2, con orden distinto (Beto antes)
  select f into v_fila from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbbeto';
  if (v_fila->>'posicion')::int <> 2 then
    raise exception 'FALLO: Beto no va en la posición 2, va en %', v_fila->>'posicion';
  end if;
  if (v_fila->>'orden')::int <> 2 then
    raise exception 'FALLO: Beto cerró antes, debería ir primero del empate (orden 2), trae %', v_fila->>'orden';
  end if;

  select f into v_fila from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbcarla';
  if (v_fila->>'posicion')::int <> 2 then
    raise exception 'FALLO: Carla empata en la posición 2, trae %', v_fila->>'posicion';
  end if;
  if (v_fila->>'orden')::int <> 3 then
    raise exception 'FALLO: Carla cerró después, va segunda del empate (orden 3), trae %', v_fila->>'orden';
  end if;
  if (v_fila->>'es_tu')::boolean is not true then
    raise exception 'FALLO: la fila de Carla no viene marcada como es_tu';
  end if;

  -- Diego no aparece: sus pendientes no son ventas
  select count(*) into v_n from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbdiego';
  if v_n <> 0 then
    raise exception 'FALLO: Diego aparece en la tabla con puros pendientes';
  end if;

  -- El ranking nunca expone dinero
  if v_lb::text like '%monto%' or v_lb::text like '%comision%' then
    raise exception 'FALLO: el leaderboard está filtrando montos';
  end if;

  -- ── 2. "yo" de Carla: rival es Ana (la de arriba), no su empate ───────────
  if (v_lb -> 'yo' ->> 'posicion')::int <> 2 then
    raise exception 'FALLO: yo.posicion de Carla debería ser 2';
  end if;
  if (v_lb -> 'yo' -> 'rival' ->> 'nombre') <> 'Zz Lbana' then
    raise exception 'FALLO: el rival de Carla debería ser Ana, es %', v_lb -> 'yo' -> 'rival' ->> 'nombre';
  end if;
  if (v_lb -> 'yo' -> 'rival' ->> 'faltan')::int <> 2 then
    raise exception 'FALLO: a Carla le faltan 2 para alcanzar a Ana, dice %', v_lb -> 'yo' -> 'rival' ->> 'faltan';
  end if;

  -- ── 3. Ana lidera: sin rival ──────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_a, 'email', 'zz-lb-ana@test.rewards', 'role', 'authenticated')::text, true);
  v_lb := rewards.leaderboard_ventas(v_hoy, 200);
  if v_lb -> 'yo' -> 'rival' <> 'null'::jsonb then
    raise exception 'FALLO: quien va #1 no debería traer rival';
  end if;

  -- ── 4. Diego: fuera del ranking esta temporada, dentro la pasada ──────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_d, 'email', 'zz-lb-diego@test.rewards', 'role', 'authenticated')::text, true);
  v_lb := rewards.leaderboard_ventas(v_hoy, 200);
  if v_lb -> 'yo' -> 'posicion' <> 'null'::jsonb then
    raise exception 'FALLO: Diego no cerró ventas, no debería traer posición';
  end if;
  if (v_lb -> 'yo' ->> 'en_proceso')::int <> 2 then
    raise exception 'FALLO: Diego trae 2 pendientes, dice %', v_lb -> 'yo' ->> 'en_proceso';
  end if;

  v_lb := rewards.leaderboard_ventas(v_previa, 200);
  if (v_lb -> 'yo' ->> 'ventas')::int <> 2 then
    raise exception 'FALLO: Diego debería traer 2 ventas en la temporada pasada';
  end if;
  -- La temporada separa de verdad: las 4 de Ana no están en la pasada
  select count(*) into v_n from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbana';
  if v_n <> 0 then
    raise exception 'FALLO: las ventas de Ana se colaron a la temporada pasada';
  end if;

  -- ── 5. Corte por p_limite: sigue reportando tu posición real ──────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_c, 'email', 'zz-lb-carla@test.rewards', 'role', 'authenticated')::text, true);
  v_lb := rewards.leaderboard_ventas(v_hoy, 3);
  if (v_lb -> 'yo' ->> 'posicion')::int <> 2 then
    raise exception 'FALLO: con corte de 3 la posición real de Carla se perdió';
  end if;

  -- ── 6. Temporada inválida ─────────────────────────────────────────────────
  begin
    perform rewards.leaderboard_ventas('2026-T9');
    raise exception 'FALLO: aceptó una temporada inválida';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%Temporada inv%' then raise; end if;
  end;

  -- ── 6b. Tabla de "en proceso": rankea pendientes, no ventas cerradas ──────
  -- Diego trae 2 pendientes y 0 cerradas: invisible en la tabla oficial, líder
  -- en esta. Es justo el caso que motivó la segunda tabla.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_d, 'email', 'zz-lb-diego@test.rewards', 'role', 'authenticated')::text, true);
  v_lb := rewards.leaderboard_ventas(v_hoy, 200, 'en_proceso');

  if (v_lb ->> 'metrica') <> 'en_proceso' then
    raise exception 'FALLO: el RPC no reporta la métrica pedida';
  end if;
  if (v_lb -> 'yo' ->> 'posicion')::int <> 1 then
    raise exception 'FALLO: Diego debería liderar en proceso, va en %', v_lb -> 'yo' -> 'posicion';
  end if;
  if (v_lb -> 'yo' ->> 'puntos')::int <> 2 then
    raise exception 'FALLO: los puntos de Diego en proceso deberían ser 2, son %', v_lb -> 'yo' ->> 'puntos';
  end if;
  -- La fila conserva el otro dato para dar contexto, sin rankear por él
  if (v_lb -> 'yo' ->> 'ventas')::int <> 0 then
    raise exception 'FALLO: Diego no tiene ventas cerradas esta temporada';
  end if;

  -- Ana lidera cerradas pero no tiene pendientes: no aparece en esta tabla
  select count(*) into v_n from jsonb_array_elements(v_lb -> 'tabla') f where f->>'nombre' = 'Zz Lbana';
  if v_n <> 0 then
    raise exception 'FALLO: Ana aparece en la tabla de en proceso sin tener pendientes';
  end if;

  -- Y en la tabla oficial Diego sigue fuera: las dos tablas no se contaminan
  v_lb := rewards.leaderboard_ventas(v_hoy, 200, 'cerradas');
  if v_lb -> 'yo' -> 'posicion' <> 'null'::jsonb then
    raise exception 'FALLO: los pendientes de Diego se colaron a la tabla de cerradas';
  end if;

  -- Los chips de temporada no cambian al alternar de pestaña
  if rewards.leaderboard_ventas(v_hoy, 200, 'en_proceso') -> 'temporadas'
     is distinct from rewards.leaderboard_ventas(v_hoy, 200, 'cerradas') -> 'temporadas' then
    raise exception 'FALLO: la lista de temporadas cambia con la métrica';
  end if;

  begin
    perform rewards.leaderboard_ventas(v_hoy, 50, 'lo_que_sea');
    raise exception 'FALLO: aceptó una métrica inválida';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%trica inv%' then raise; end if;
  end;

  -- ── 7. Fix: pausar la oferta la saca del marketplace de verdad ────────────
  perform set_config('request.jwt.claims', null, true);

  -- (control) publicada = visible para el vendedor
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_c, 'email', 'zz-lb-carla@test.rewards', 'role', 'authenticated')::text, true);
  select count(*) into v_n
  from jsonb_array_elements(rewards.ofertas_publicadas()) e
  where (e->>'oferta_id')::uuid = v_of_id;
  if v_n <> 1 then
    raise exception 'FALLO: la oferta publicada no aparece en el marketplace';
  end if;

  -- el panel de empresa apaga la bandera vieja `activa`
  perform set_config('request.jwt.claims', null, true);
  update rewards.ofertas set activa = false where id = v_of_id;

  select estado::text into v_err from rewards.ofertas where id = v_of_id;
  if v_err <> 'pausada' then
    raise exception 'FALLO: escribir activa=false dejó estado en %', v_err;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid_c, 'email', 'zz-lb-carla@test.rewards', 'role', 'authenticated')::text, true);
  select count(*) into v_n
  from jsonb_array_elements(rewards.ofertas_publicadas()) e
  where (e->>'oferta_id')::uuid = v_of_id;
  if v_n <> 0 then
    raise exception 'FALLO: la oferta pausada le sigue apareciendo al vendedor';
  end if;

  -- y se puede republicar
  perform set_config('request.jwt.claims', null, true);
  update rewards.ofertas set estado = 'publicada' where id = v_of_id;
  if not (select activa from rewards.ofertas where id = v_of_id) then
    raise exception 'FALLO: republicar no volvió a prender activa';
  end if;

  raise notice 'TODOS LOS ASSERTS PASARON ✔ (rollback a continuación, cero residuos)';
end;
$test$;

rollback;
