-- Yaub Rewards · Leaderboard de ventas por temporada (Feature: gamificación).
--
-- Reglas de negocio:
--   · Una "temporada Yaub" es un trimestre natural en hora de México
--     (America/Monterrey): T1 ene–mar, T2 abr–jun, T3 jul–sep, T4 oct–dic.
--     La clave es 'YYYY-Tn' (p. ej. '2026-T3').
--   · El ranking mide VOLUMEN DE VENTAS, nunca dinero: el RPC no expone
--     monto_mxn, comisiones, teléfonos ni CLABE de nadie. Solo nombre, foto y
--     número de ventas — lo mínimo para que la competencia se vea.
--   · Cuenta como venta un referido en 'liberado' o 'pagado' (mismo criterio
--     que rewards.stats_publicas().ventas_cerradas). La fecha de la venta es
--     coalesce(liberado_at, created_at): una venta cerrada pertenece a la
--     temporada en la que se cerró, no en la que se capturó el prospecto.
--   · 'en_proceso' (pendientes) se muestra como dato secundario, no rankea.
--   · Los vendedores no se pueden leer entre sí por RLS (freelancers_select),
--     así que esto vive en un security definer con acceso restringido a
--     vendedores registrados y admins.

-- ── Helpers de temporada ─────────────────────────────────────────────────────
-- Immutable: `timezone(text, timestamptz)` lo es en Postgres, así que la clave
-- de un timestamp dado nunca cambia y el índice de abajo es válido.

create or replace function rewards.temporada_de(p_ts timestamptz)
returns text
language sql immutable
set search_path = ''
as $$
  select to_char(p_ts at time zone 'America/Monterrey', 'YYYY"-T"Q');
$$;

create or replace function rewards.temporada_inicio(p_clave text)
returns timestamptz
language sql immutable
set search_path = ''
as $$
  select make_timestamptz(
    split_part(p_clave, '-T', 1)::int,
    (split_part(p_clave, '-T', 2)::int - 1) * 3 + 1,
    1, 0, 0, 0, 'America/Monterrey'
  );
$$;

revoke execute on function rewards.temporada_de(timestamptz) from public, anon;
revoke execute on function rewards.temporada_inicio(text) from public, anon;
grant execute on function rewards.temporada_de(timestamptz) to authenticated, service_role;
grant execute on function rewards.temporada_inicio(text) to authenticated, service_role;

-- Índice por fecha de venta: el leaderboard siempre filtra por rango de temporada.
create index if not exists referidos_fecha_venta_idx
  on rewards.referidos (coalesce(liberado_at, created_at));

-- ── Leaderboard ──────────────────────────────────────────────────────────────
-- Devuelve la tabla de la temporada + la posición del vendedor que llama y a
-- quién tiene justo arriba (el "rival"), para el copy motivacional.
create or replace function rewards.leaderboard_ventas(
  p_temporada text default null,
  p_limite int default 50
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_yo uuid := rewards.current_freelancer_id();
  v_admin boolean := rewards.is_admin();
  v_clave text;
  v_actual text := rewards.temporada_de(now());
  v_ini timestamptz;
  v_fin timestamptz;
  v_limite int := least(greatest(coalesce(p_limite, 50), 3), 200);
  v_out jsonb;
begin
  if v_yo is null and not v_admin then
    raise exception 'Solo vendedores registrados pueden ver el leaderboard';
  end if;

  v_clave := upper(coalesce(nullif(trim(p_temporada), ''), v_actual));
  if v_clave !~ '^\d{4}-T[1-4]$' then
    raise exception 'Temporada inválida: %', v_clave;
  end if;
  v_ini := rewards.temporada_inicio(v_clave);
  v_fin := v_ini + interval '3 months';

  with movimientos as (
    select r.freelancer_id,
           count(*) filter (
             where r.estatus in ('liberado'::rewards.referido_estatus,
                                 'pagado'::rewards.referido_estatus)
           ) as ventas,
           count(*) filter (
             where r.estatus = 'pendiente'::rewards.referido_estatus
           ) as en_proceso,
           max(coalesce(r.liberado_at, r.created_at)) filter (
             where r.estatus in ('liberado'::rewards.referido_estatus,
                                 'pagado'::rewards.referido_estatus)
           ) as ultima_venta
    from rewards.referidos r
    where coalesce(r.liberado_at, r.created_at) >= v_ini
      and coalesce(r.liberado_at, r.created_at) < v_fin
    group by r.freelancer_id
  ),
  -- `posicion` empata (1,2,2,4) como en cualquier tabla deportiva; `orden` sí
  -- es único para pintar las filas: a igual número de ventas va primero quien
  -- llegó antes a ese número.
  tabla as (
    select m.freelancer_id,
           m.ventas,
           m.en_proceso,
           m.ultima_venta,
           f.nombre,
           f.avatar_url,
           rank() over (order by m.ventas desc) as posicion,
           row_number() over (
             order by m.ventas desc, m.ultima_venta asc nulls last, f.nombre asc
           ) as orden
    from movimientos m
    join rewards.freelancers f on f.id = m.freelancer_id
    where m.ventas > 0
  )
  select jsonb_build_object(
    'temporada', jsonb_build_object(
      'clave', v_clave,
      'inicio', v_ini,
      'fin', v_fin,
      'actual', v_clave = v_actual,
      'dias_restantes', case
        when v_clave = v_actual then greatest(0, ceil(extract(epoch from (v_fin - now())) / 86400)::int)
        else 0
      end,
      'progreso', case
        when v_clave = v_actual then least(1, greatest(0,
          extract(epoch from (now() - v_ini)) / nullif(extract(epoch from (v_fin - v_ini)), 0)))::float8
        else 1::float8
      end
    ),
    'temporadas', (
      select coalesce(jsonb_agg(t.clave order by t.clave desc), '[]'::jsonb)
      from (
        select distinct rewards.temporada_de(coalesce(r.liberado_at, r.created_at)) as clave
        from rewards.referidos r
        where r.estatus in ('liberado'::rewards.referido_estatus,
                            'pagado'::rewards.referido_estatus)
        union
        select v_actual
        union
        select v_clave
      ) t
    ),
    'totales', jsonb_build_object(
      'vendedores', (select count(*) from tabla t),
      'ventas', (select coalesce(sum(t.ventas), 0) from tabla t)
    ),
    'tabla', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'orden', t.orden,
        'posicion', t.posicion,
        'nombre', t.nombre,
        'avatar_url', t.avatar_url,
        'ventas', t.ventas,
        'en_proceso', t.en_proceso,
        'ultima_venta', t.ultima_venta,
        'es_tu', t.freelancer_id = v_yo
      ) order by t.orden), '[]'::jsonb)
      from tabla t
      where t.orden <= v_limite
    ),
    'yo', case when v_yo is null then null else (
      select jsonb_build_object(
        'ventas', coalesce(t.ventas, 0),
        'en_proceso', coalesce(t.en_proceso, (
          select m.en_proceso from movimientos m where m.freelancer_id = v_yo
        ), 0),
        'posicion', t.posicion,
        'en_tabla', coalesce(t.orden <= v_limite, false),
        'nombre', coalesce(t.nombre, (
          select f.nombre from rewards.freelancers f where f.id = v_yo
        )),
        'avatar_url', coalesce(t.avatar_url, (
          select f.avatar_url from rewards.freelancers f where f.id = v_yo
        )),
        'rival', (
          select jsonb_build_object(
            'nombre', s.nombre,
            'posicion', s.posicion,
            'ventas', s.ventas,
            'faltan', s.ventas - coalesce(t.ventas, 0)
          )
          from tabla s
          where s.ventas > coalesce(t.ventas, 0)
          order by s.ventas asc, s.posicion desc
          limit 1
        )
      )
      from (select 1) z
      left join tabla t on t.freelancer_id = v_yo
    ) end
  ) into v_out;

  return v_out;
end;
$$;

revoke execute on function rewards.leaderboard_ventas(text, int) from public, anon;
grant execute on function rewards.leaderboard_ventas(text, int) to authenticated, service_role;

notify pgrst, 'reload schema';
