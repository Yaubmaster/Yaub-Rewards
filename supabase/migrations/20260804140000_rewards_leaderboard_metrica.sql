-- Yaub Rewards · el leaderboard ahora tiene dos tablas: ventas cerradas y
-- referidos en proceso.
--
-- Por qué dos: un vendedor que acaba de arrancar puede traer 6 prospectos
-- capturados y ninguno liberado todavía. En la tabla de cerradas no aparece, y
-- ver la pantalla vacía desmotiva justo a quien más está trabajando. La tabla
-- de "en proceso" premia el esfuerzo de esta semana; la de "cerradas" sigue
-- siendo el marcador oficial de la temporada.
--
-- La métrica solo cambia POR QUÉ COLUMNA se rankea. Todo lo demás se mantiene:
-- mismo recorte por temporada, mismos empates, y sigue sin viajar un solo peso.
--
-- Se dropea la firma vieja de 2 args: dejar ambas crearía un overload ambiguo
-- en PostgREST (PGRST203). La nueva acepta las mismas llamadas porque todos sus
-- parámetros tienen default.

drop function if exists rewards.leaderboard_ventas(text, int);

create function rewards.leaderboard_ventas(
  p_temporada text default null,
  p_limite int default 50,
  p_metrica text default 'cerradas'
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
  v_metrica text := lower(coalesce(nullif(trim(p_metrica), ''), 'cerradas'));
  v_ini timestamptz;
  v_fin timestamptz;
  v_limite int := least(greatest(coalesce(p_limite, 50), 3), 200);
  v_out jsonb;
begin
  if v_yo is null and not v_admin then
    raise exception 'Solo vendedores registrados pueden ver el leaderboard';
  end if;

  if v_metrica not in ('cerradas', 'en_proceso') then
    raise exception 'Métrica inválida: %', v_metrica;
  end if;

  v_clave := upper(coalesce(nullif(trim(p_temporada), ''), v_actual));
  if v_clave !~ '^\d{4}-T[1-4]$' then
    raise exception 'Temporada inválida: %', v_clave;
  end if;
  v_ini := rewards.temporada_inicio(v_clave);
  v_fin := v_ini + interval '3 months';

  with movimientos as (
    -- Un pendiente no tiene liberado_at, así que coalesce() lo ubica por su
    -- fecha de captura y la venta cerrada por su fecha de cierre. La misma
    -- expresión sirve para las dos métricas.
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
           ) as ultima_venta,
           max(r.created_at) filter (
             where r.estatus = 'pendiente'::rewards.referido_estatus
           ) as ultimo_pendiente
    from rewards.referidos r
    where coalesce(r.liberado_at, r.created_at) >= v_ini
      and coalesce(r.liberado_at, r.created_at) < v_fin
    group by r.freelancer_id
  ),
  -- `puntos` es la columna por la que se rankea según la métrica pedida.
  puntos as (
    select m.*,
           case when v_metrica = 'en_proceso' then m.en_proceso else m.ventas end as puntos,
           case when v_metrica = 'en_proceso' then m.ultimo_pendiente else m.ultima_venta end as ultima
    from movimientos m
  ),
  -- `posicion` empata (1,2,2,4) como en cualquier tabla deportiva; `orden` sí
  -- es único para pintar las filas: a igual número va primero quien llegó antes.
  tabla as (
    select p.freelancer_id,
           p.ventas,
           p.en_proceso,
           p.puntos,
           p.ultima,
           f.nombre,
           f.avatar_url,
           rank() over (order by p.puntos desc) as posicion,
           row_number() over (
             order by p.puntos desc, p.ultima asc nulls last, f.nombre asc
           ) as orden
    from puntos p
    join rewards.freelancers f on f.id = p.freelancer_id
    where p.puntos > 0
  )
  select jsonb_build_object(
    'metrica', v_metrica,
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
    -- La lista de temporadas NO depende de la métrica: si cambiara al alternar
    -- las pestañas, los chips brincarían debajo del dedo del usuario.
    'temporadas', (
      select coalesce(jsonb_agg(t.clave order by t.clave desc), '[]'::jsonb)
      from (
        select distinct rewards.temporada_de(coalesce(r.liberado_at, r.created_at)) as clave
        from rewards.referidos r
        union
        select v_actual
        union
        select v_clave
      ) t
    ),
    'totales', jsonb_build_object(
      'vendedores', (select count(*) from tabla t),
      'puntos', (select coalesce(sum(t.puntos), 0) from tabla t)
    ),
    'tabla', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'orden', t.orden,
        'posicion', t.posicion,
        'nombre', t.nombre,
        'avatar_url', t.avatar_url,
        'puntos', t.puntos,
        'ventas', t.ventas,
        'en_proceso', t.en_proceso,
        'ultima', t.ultima,
        'es_tu', t.freelancer_id = v_yo
      ) order by t.orden), '[]'::jsonb)
      from tabla t
      where t.orden <= v_limite
    ),
    'yo', case when v_yo is null then null else (
      select jsonb_build_object(
        'puntos', coalesce(t.puntos, 0),
        'ventas', coalesce(t.ventas, (
          select m.ventas from movimientos m where m.freelancer_id = v_yo
        ), 0),
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
            'puntos', s.puntos,
            'faltan', s.puntos - coalesce(t.puntos, 0)
          )
          from tabla s
          where s.puntos > coalesce(t.puntos, 0)
          order by s.puntos asc, s.posicion desc
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

revoke execute on function rewards.leaderboard_ventas(text, int, text) from public, anon;
grant execute on function rewards.leaderboard_ventas(text, int, text) to authenticated, service_role;

notify pgrst, 'reload schema';
