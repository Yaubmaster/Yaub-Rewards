-- Yaub Rewards · Referidos entre vendedores, gamificado (Feature 3).
-- Reglas de negocio:
--   · El código compartible ES rewards.freelancers.codigo (ya único) — no se
--     duplica en otra tabla.
--   · Alta con código válido → bono en 'pendiente' de inmediato ($50 nuevo /
--     $100 referrer).
--   · Cuando el vendedor nuevo COBRA su 3ª comisión (referidos.estatus →
--     'pagado'), se liberan ambos montos en el mismo evento. Idempotente.
--   · Cada monto se paga por separado a su dueño vía marcar_pago (timestamps
--     por lado), porque referrer y referido cobran en cortes distintos.
--   · Anti-abuso: código propio prohibido, solo se puede ser referido una vez.

create type rewards.bono_estatus as enum ('pendiente', 'liberado');

create table if not exists rewards.freelancer_referidos (
  id uuid primary key default gen_random_uuid(),
  referrer_freelancer_id uuid not null references rewards.freelancers(id),
  referred_freelancer_id uuid not null unique references rewards.freelancers(id),
  estatus rewards.bono_estatus not null default 'pendiente',
  monto_referido_mxn numeric not null default 50,
  monto_referrer_mxn numeric not null default 100,
  referido_disparador_id uuid references rewards.referidos(id),
  referrer_pagado_at timestamptz,
  referido_pagado_at timestamptz,
  created_at timestamptz not null default now(),
  liberado_at timestamptz,
  constraint freelancer_referidos_distintos check (referrer_freelancer_id <> referred_freelancer_id)
);

create index if not exists freelancer_referidos_referrer_idx
  on rewards.freelancer_referidos (referrer_freelancer_id);

alter table rewards.freelancer_referidos enable row level security;

-- Cada quien ve solo las filas donde participa; admin todo.
-- Escritura únicamente vía RPC/trigger (security definer) o service_role.
create policy freelancer_referidos_select on rewards.freelancer_referidos
for select to authenticated
using (
  referrer_freelancer_id = rewards.current_freelancer_id()
  or referred_freelancer_id = rewards.current_freelancer_id()
  or rewards.is_admin()
);

grant select on rewards.freelancer_referidos to authenticated;
grant all on rewards.freelancer_referidos to service_role;

-- ── Validación de código (para forms; no revela más que validez y nombre) ────
create or replace function rewards.validar_codigo_vendedor(p_codigo text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case
    when f.id is null then jsonb_build_object('valido', false)
    else jsonb_build_object('valido', true, 'nombre', f.nombre)
  end
  from (select 1) x
  left join rewards.freelancers f
    on upper(f.codigo) = upper(trim(coalesce(p_codigo, ''))) and f.activo;
$$;

revoke execute on function rewards.validar_codigo_vendedor(text) from public, anon;
grant execute on function rewards.validar_codigo_vendedor(text) to authenticated, service_role;

-- ── registrar_freelancer v2: acepta código de referido opcional ──────────────
-- Retro-compatible: misma lógica idempotente; el código solo aplica en el alta
-- real (un vendedor ya registrado no puede ser referido después).
-- Se dropea la firma de 2 args: dejar ambas crearía un overload ambiguo en
-- PostgREST (PGRST203); la nueva tiene default y acepta las mismas llamadas.
drop function if exists rewards.registrar_freelancer(text, text);

create function rewards.registrar_freelancer(
  p_nombre text,
  p_telefono text default null,
  p_codigo_referido text default null
)
returns rewards.freelancers
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row rewards.freelancers;
  v_referrer uuid;
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

  -- valida el código ANTES de crear el perfil, para que el form pueda corregir
  if coalesce(trim(p_codigo_referido), '') <> '' then
    select f.id into v_referrer
    from rewards.freelancers f
    where upper(f.codigo) = upper(trim(p_codigo_referido)) and f.activo;
    if v_referrer is null then
      raise exception 'codigo_invalido';
    end if;
  end if;

  for i in 1..5 loop
    begin
      insert into rewards.freelancers (user_id, nombre, telefono, codigo)
      values (v_uid, trim(p_nombre), nullif(trim(p_telefono), ''), rewards.generar_codigo(p_nombre))
      returning * into v_row;
      exit;
    exception when unique_violation then
      select * into v_row from rewards.freelancers where user_id = v_uid;
      if found then
        return v_row;
      end if;
    end;
  end loop;
  if v_row.id is null then
    raise exception 'No se pudo generar un código único, intenta de nuevo';
  end if;

  if v_referrer is not null then
    if v_referrer = v_row.id then
      raise exception 'codigo_propio';  -- defensa; imposible en alta nueva
    end if;
    insert into rewards.freelancer_referidos (referrer_freelancer_id, referred_freelancer_id)
    values (v_referrer, v_row.id)
    on conflict (referred_freelancer_id) do nothing;  -- solo se puede ser referido una vez
  end if;

  return v_row;
end;
$$;

revoke execute on function rewards.registrar_freelancer(text, text, text) from public, anon;
grant execute on function rewards.registrar_freelancer(text, text, text) to authenticated, service_role;

-- ── Liberación en la 3ª comisión COBRADA (estatus → 'pagado') ────────────────
-- AFTER ROW: al final del statement, por lo que un corte que paga 3 comisiones
-- de golpe ya cuenta las 3. Idempotente: FOR UPDATE + predicado 'pendiente'.
create or replace function rewards.tg_liberar_bono_referido()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_bono rewards.freelancer_referidos;
  v_pagadas integer;
begin
  select * into v_bono
  from rewards.freelancer_referidos
  where referred_freelancer_id = new.freelancer_id and estatus = 'pendiente'
  for update;

  if not found then
    return new;  -- no fue referido, o su bono ya se liberó
  end if;

  select count(*) into v_pagadas
  from rewards.referidos
  where freelancer_id = new.freelancer_id and estatus = 'pagado';

  if v_pagadas >= 3 then
    update rewards.freelancer_referidos
    set estatus = 'liberado',
        liberado_at = now(),
        referido_disparador_id = new.id
    where id = v_bono.id and estatus = 'pendiente';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rewards_liberar_bono on rewards.referidos;
create trigger trg_rewards_liberar_bono
after update of estatus on rewards.referidos
for each row
when (new.estatus = 'pagado' and old.estatus is distinct from new.estatus)
execute function rewards.tg_liberar_bono_referido();

-- ── marcar_pago v2: incluye bonos liberados (cada lado cobra lo suyo) ────────
-- Aditivo: misma firma y mismo comportamiento para comisiones; los bonos
-- 'liberado' del freelancer (como referrer y como referido) entran al corte y
-- se marcan pagados por lado. Idempotente por los predicados *_pagado_at IS NULL.
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
  v_bono_referrer numeric;
  v_n_referrer int;
  v_bono_referido numeric;
  v_n_referido int;
  v_notas text;
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

  with upd_r as (
    update rewards.freelancer_referidos
    set referrer_pagado_at = now()
    where referrer_freelancer_id = p_freelancer_id
      and estatus = 'liberado'
      and referrer_pagado_at is null
    returning monto_referrer_mxn
  )
  select coalesce(sum(monto_referrer_mxn), 0), count(*) into v_bono_referrer, v_n_referrer from upd_r;

  with upd_d as (
    update rewards.freelancer_referidos
    set referido_pagado_at = now()
    where referred_freelancer_id = p_freelancer_id
      and estatus = 'liberado'
      and referido_pagado_at is null
    returning monto_referido_mxn
  )
  select coalesce(sum(monto_referido_mxn), 0), count(*) into v_bono_referido, v_n_referido from upd_d;

  if v_n + v_n_referrer + v_n_referido = 0 then
    raise exception 'Este freelancer no tiene comisiones liberadas por pagar';
  end if;

  v_notas := p_notas;
  if v_bono_referrer + v_bono_referido > 0 then
    v_notas := concat_ws(' · ', v_notas,
      format('incluye bonos de referidos: $%s MXN', (v_bono_referrer + v_bono_referido)::text));
  end if;

  insert into rewards.pagos (freelancer_id, monto_mxn, metodo, notas)
  values (p_freelancer_id, v_total + v_bono_referrer + v_bono_referido,
          coalesce(p_metodo, 'transferencia'), v_notas)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Resumen para el dashboard gamificado ─────────────────────────────────────
-- El referrer no puede leer el perfil del referido por RLS; este definer expone
-- solo nombre + progreso, nada sensible.
create or replace function rewards.mis_referidos_resumen()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with yo as (select rewards.current_freelancer_id() as id)
  select jsonb_build_object(
    'como_referrer', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fr.id,
        'nombre', f.nombre,
        'comisiones_pagadas', least(3, (
          select count(*) from rewards.referidos r
          where r.freelancer_id = fr.referred_freelancer_id and r.estatus = 'pagado'
        )),
        'estatus', fr.estatus,
        'monto_mxn', fr.monto_referrer_mxn,
        'pagado', fr.referrer_pagado_at is not null,
        'liberado_at', fr.liberado_at,
        'created_at', fr.created_at
      ) order by fr.created_at desc)
      from rewards.freelancer_referidos fr
      join rewards.freelancers f on f.id = fr.referred_freelancer_id
      where fr.referrer_freelancer_id = (select id from yo)
    ), '[]'::jsonb),
    'como_referido', (
      select jsonb_build_object(
        'referrer_nombre', f.nombre,
        'comisiones_pagadas', least(3, (
          select count(*) from rewards.referidos r
          where r.freelancer_id = fr.referred_freelancer_id and r.estatus = 'pagado'
        )),
        'estatus', fr.estatus,
        'monto_mxn', fr.monto_referido_mxn,
        'pagado', fr.referido_pagado_at is not null,
        'liberado_at', fr.liberado_at
      )
      from rewards.freelancer_referidos fr
      join rewards.freelancers f on f.id = fr.referrer_freelancer_id
      where fr.referred_freelancer_id = (select id from yo)
    )
  );
$$;

revoke execute on function rewards.mis_referidos_resumen() from public, anon;
grant execute on function rewards.mis_referidos_resumen() to authenticated, service_role;

-- ── Realtime: la liberación del bono dispara la celebración en vivo ──────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'rewards'
      and tablename = 'freelancer_referidos'
  ) then
    alter publication supabase_realtime add table rewards.freelancer_referidos;
  end if;
end;
$$;

notify pgrst, 'reload schema';
