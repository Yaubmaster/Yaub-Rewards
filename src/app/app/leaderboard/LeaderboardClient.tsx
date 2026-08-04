'use client';

// Leaderboard de la temporada Yaub: quién va ganando.
//
// Dos tablas sobre los mismos datos:
//   · Ventas cerradas — el marcador oficial de la temporada.
//   · En proceso — referidos capturados que aún no se liberan, para que quien
//     está trabajando duro se vea aunque todavía no cierre.
//
// Todo lo que se compara aquí es volumen, nunca dinero: el RPC no manda montos
// ni comisiones de nadie. Cada trimestre es una temporada nueva, así que el
// marcador se reinicia y todos vuelven a arrancar parejos.
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Icon, ICON_PATHS } from '@/components/icons';
import {
  cargarLeaderboard,
  METRICAS,
  type Leaderboard,
  type LeaderboardFila,
  type Metrica,
} from '@/lib/leaderboard';
import { etiquetaTemporada, mesesTemporada, nombreTemporada } from '@/lib/temporadas';
import { tiempoRelativo } from '@/lib/format';

// Los tonos viven en globals.css porque cambian con el tema: el bronce de modo
// claro se pierde sobre la tarjeta oscura.
const MEDALLAS: Record<number, { emoji: string; color: string; fondo: string }> = {
  1: { emoji: '🥇', color: 'rgb(var(--oro))', fondo: 'rgb(var(--oro) / .14)' },
  2: { emoji: '🥈', color: 'rgb(var(--plata))', fondo: 'rgb(var(--plata) / .16)' },
  3: { emoji: '🥉', color: 'rgb(var(--bronce))', fondo: 'rgb(var(--bronce) / .14)' },
};

/** Renglón secundario: el dato que NO se está rankeando, para dar contexto */
function subtitulo(f: LeaderboardFila, metrica: Metrica) {
  const otro =
    metrica === 'cerradas'
      ? f.en_proceso > 0 && `${f.en_proceso} en proceso`
      : f.ventas > 0 && `${f.ventas} ${f.ventas === 1 ? 'cerrada' : 'cerradas'}`;
  const cuando = f.ultima ? tiempoRelativo(f.ultima) : null;
  return [otro, cuando].filter(Boolean).join(' · ') || 'sin movimiento reciente';
}

function Fila({ f, metrica }: { f: LeaderboardFila; metrica: Metrica }) {
  const medalla = MEDALLAS[f.posicion];
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all ${
        f.es_tu ? 'destacado-tu' : 'bg-white'
      }`}
      style={{ borderColor: f.es_tu ? '#8B5CF6' : 'rgb(var(--linea))' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
        style={
          medalla
            ? { background: medalla.fondo, color: medalla.color }
            : { background: 'rgb(var(--superficie))', color: 'rgb(var(--tinta3))' }
        }
      >
        {medalla ? medalla.emoji : f.posicion}
      </div>

      <Avatar url={f.avatar_url} nombre={f.nombre} size={38} forma="circulo" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{f.nombre}</span>
          {f.es_tu && (
            <span className="shrink-0 rounded-full bg-violet1 px-1.5 py-px text-[10px] font-extrabold text-white">
              TÚ
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate3">{subtitulo(f, metrica)}</div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[17px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {f.puntos}
        </div>
        <div className="text-[10.5px] font-semibold text-slate3">
          {metrica === 'cerradas' ? (f.puntos === 1 ? 'venta' : 'ventas') : 'en proceso'}
        </div>
      </div>
    </div>
  );
}

function Podio({ f, metrica }: { f: LeaderboardFila; metrica: Metrica }) {
  const medalla = MEDALLAS[f.posicion] ?? MEDALLAS[3];
  // El primer lugar sube un escalón, como en un podio de verdad
  const primero = f.posicion === 1;
  return (
    <div
      className={`flex flex-col items-center rounded-[18px] border px-2 py-4 text-center ${
        f.es_tu ? 'destacado-tu' : 'bg-white'
      }`}
      style={{
        borderColor: f.es_tu ? '#8B5CF6' : 'rgb(var(--linea))',
        marginTop: primero ? 0 : 14,
      }}
    >
      <div className="text-[22px] leading-none">{medalla.emoji}</div>
      <div className="mt-2">
        <Avatar url={f.avatar_url} nombre={f.nombre} size={primero ? 54 : 46} forma="circulo" />
      </div>
      <div className="mt-2 w-full truncate px-1 text-[12.5px] font-bold">
        {f.nombre.split(' ').slice(0, 2).join(' ')}
      </div>
      <div
        className="mt-1 text-[22px] font-extrabold leading-none"
        style={{ color: medalla.color, fontVariantNumeric: 'tabular-nums' }}
      >
        {f.puntos}
      </div>
      <div className="text-[10.5px] font-semibold text-slate3">
        {metrica === 'cerradas' ? (f.puntos === 1 ? 'venta' : 'ventas') : 'en proceso'}
      </div>
      {f.es_tu && (
        <span className="mt-1.5 rounded-full bg-violet1 px-2 py-px text-[10px] font-extrabold text-white">
          TÚ
        </span>
      )}
    </div>
  );
}

export function LeaderboardClient({ inicial }: { inicial: Leaderboard | null }) {
  const [data, setData] = useState<Leaderboard | null>(inicial);
  const [clave, setClave] = useState(inicial?.temporada.clave ?? '');
  const [metrica, setMetrica] = useState<Metrica>(inicial?.metrica ?? 'cerradas');
  const [cargando, setCargando] = useState(inicial === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.temporada.clave === clave && data.metrica === metrica) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    cargarLeaderboard(clave || undefined, metrica)
      .then((d) => vivo && setData(d))
      .catch((e: Error) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, metrica]);

  const temporadas = data?.temporadas ?? [];
  const activa = data?.temporada.clave ?? clave;
  // Mientras recarga, el copy sigue el tab que el usuario acaba de tocar
  const m = METRICAS[metrica];
  const tabla = data?.tabla ?? [];
  const yo = data?.yo ?? null;
  const podio = tabla.length >= 3 ? tabla.slice(0, 3) : [];
  const resto = podio.length ? tabla.slice(3) : tabla;
  const rankeado = yo?.posicion != null;

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Leaderboard 🏆</h1>
          <p className="mt-0.5 text-sm text-slate2">
            {activa ? nombreTemporada(activa) : 'Temporada Yaub'}
            {activa && <span className="text-slate3"> · {mesesTemporada(activa)}</span>}
          </p>
        </div>
        {data && (
          <div className="rounded-xl border border-line bg-surface px-3 py-2 text-right">
            <div className="text-[15px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {data.totales.puntos}
            </div>
            <div className="text-[11px] text-slate3">
              {metrica === 'cerradas' ? 'ventas' : 'en proceso'} · {data.totales.vendedores}{' '}
              {data.totales.vendedores === 1 ? 'vendedor' : 'vendedores'}
            </div>
          </div>
        )}
      </div>

      {/* Cerradas vs en proceso */}
      <div className="mt-4 flex rounded-xl border border-line bg-surface p-1">
        {(Object.keys(METRICAS) as Metrica[]).map((k) => (
          <button
            key={k}
            onClick={() => setMetrica(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors ${
              metrica === k ? 'bg-white text-ink shadow-sm' : 'text-slate3 hover:text-slate2'
            }`}
          >
            {METRICAS[k].tab}
          </button>
        ))}
      </div>

      {/* Filtro por temporada */}
      {temporadas.length > 0 && (
        <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {temporadas.map((t) => {
            const on = t === activa;
            return (
              <button
                key={t}
                onClick={() => setClave(t)}
                className="shrink-0 rounded-full border px-[15px] py-2 text-[13px] font-semibold transition-all"
                style={
                  on
                    ? { background: 'rgb(var(--tinta))', color: 'rgb(var(--card))', borderColor: 'rgb(var(--tinta))' }
                    : { background: 'rgb(var(--card))', color: 'rgb(var(--tinta2))', borderColor: 'rgb(var(--linea))' }
                }
              >
                {etiquetaTemporada(t)}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-red-500">
          {error}
        </div>
      )}

      {cargando && (
        <div className="mt-4 flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer h-[68px] rounded-2xl" />
          ))}
        </div>
      )}

      {!cargando && data && (
        <>
          {/* Tu posición. Con ranking va sobre degradado (texto blanco legible en
              ambos temas); sin ranking va sobre tarjeta normal, porque una
              superficie de tinta se vuelve casi blanca en oscuro. */}
          {yo && (
            <div
              className={`mt-4 rounded-[20px] p-[22px] ${rankeado ? 'text-white' : 'card'}`}
              style={
                rankeado ? { background: m.gradiente, boxShadow: m.sombra } : undefined
              }
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div
                    className={`text-xs font-semibold tracking-[0.1em] ${
                      rankeado ? 'opacity-85' : 'text-slate3'
                    }`}
                  >
                    {m.heroLabel}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[44px] font-extrabold leading-none tracking-tight">
                      {yo.posicion === null ? '—' : `#${yo.posicion}`}
                    </span>
                    {rankeado && (
                      <span className="text-sm opacity-85">de {data.totales.vendedores}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[32px] font-extrabold leading-none">
                    <AnimatedNumber value={yo.puntos} prefix="" duration={700} />
                  </div>
                  <div className={`text-[12.5px] ${rankeado ? 'opacity-85' : 'text-slate2'}`}>
                    {m.unidad(yo.puntos)}
                  </div>
                </div>
              </div>

              <div
                className={`mt-3.5 text-[13.5px] font-medium leading-snug ${
                  rankeado ? 'opacity-95' : 'text-slate2'
                }`}
              >
                {yo.posicion === null ? (
                  metrica === 'cerradas' ? (
                    <>
                      Todavía no entras al ranking de cerradas.
                      {yo.en_proceso > 0
                        ? ` Traes ${yo.en_proceso} en proceso: en cuanto se libere el primero, entras. 🚀`
                        : ' Tu primera venta cerrada te mete a la tabla. 🚀'}
                    </>
                  ) : (
                    <>Captura un referido con tu código y apareces aquí de inmediato. 🌱</>
                  )
                ) : yo.rival ? (
                  <>
                    Te {yo.rival.faltan === 1 ? 'falta' : 'faltan'}{' '}
                    <strong>{yo.rival.faltan}</strong> para alcanzar a{' '}
                    {yo.rival.nombre.split(' ')[0]} (#{yo.rival.posicion}). 🔥
                  </>
                ) : (
                  <>Vas en la cima de la temporada. Nadie te ha alcanzado. 👑</>
                )}
              </div>

              {/* Avance de la temporada */}
              <div className="mt-4">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: rankeado ? 'rgba(255,255,255,.25)' : 'rgb(var(--superficie))' }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.round((data.temporada.progreso ?? 0) * 100)}%`,
                      background: rankeado ? '#fff' : 'rgb(var(--tinta3))',
                    }}
                  />
                </div>
                <div
                  className={`mt-1.5 text-[11.5px] ${rankeado ? 'opacity-80' : 'text-slate3'}`}
                >
                  {data.temporada.actual
                    ? `Quedan ${data.temporada.dias_restantes} ${
                        data.temporada.dias_restantes === 1 ? 'día' : 'días'
                      } de la temporada — al cerrar, el marcador se reinicia.`
                    : 'Temporada cerrada.'}
                </div>
              </div>
            </div>
          )}

          {/* Podio */}
          {podio.length === 3 && (
            <div className="mt-3.5 grid grid-cols-3 items-start gap-2.5">
              {[podio[1], podio[0], podio[2]].map((f) => (
                <Podio key={f.orden} f={f} metrica={metrica} />
              ))}
            </div>
          )}

          {/* Tabla */}
          {resto.length > 0 && (
            <div className="mt-3.5 flex flex-col gap-2">
              {resto.map((f) => (
                <Fila key={f.orden} f={f} metrica={metrica} />
              ))}
            </div>
          )}

          {/* Tú, cuando quedaste fuera del corte visible */}
          {yo && yo.posicion !== null && !yo.en_tabla && (
            <div className="mt-2">
              <div className="mb-2 text-center text-[11px] font-semibold text-slate3">···</div>
              <Fila
                metrica={metrica}
                f={{
                  orden: -1,
                  posicion: yo.posicion,
                  nombre: yo.nombre,
                  avatar_url: yo.avatar_url,
                  puntos: yo.puntos,
                  ventas: yo.ventas,
                  en_proceso: yo.en_proceso,
                  ultima: null,
                  es_tu: true,
                }}
              />
            </div>
          )}

          {tabla.length === 0 && (
            <div className="mt-4 rounded-[20px] border border-dashed border-line bg-surface px-5 py-[52px] text-center">
              <div className="text-[38px]">{m.vacio.emoji}</div>
              <div className="mt-2.5 text-base font-bold">{m.vacio.titulo}</div>
              <div className="mt-1 text-sm text-slate2">{m.vacio.texto}</div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3">
            <Icon d={ICON_PATHS.shield} size={16} strokeWidth={2} stroke="rgb(var(--tinta3))" />
            <p className="text-[12px] leading-relaxed text-slate3">{m.nota}</p>
          </div>
        </>
      )}
    </div>
  );
}
