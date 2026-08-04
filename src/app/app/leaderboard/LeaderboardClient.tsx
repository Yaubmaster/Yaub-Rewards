'use client';

// Leaderboard de la temporada Yaub: quién va ganando en VENTAS.
//
// Todo lo que se compara aquí es volumen — cuántas ventas cerró cada quien —
// nunca dinero: el RPC no manda montos ni comisiones de nadie. Cada trimestre
// es una temporada nueva, así que el marcador se reinicia y todos vuelven a
// arrancar parejos.
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Icon, ICON_PATHS } from '@/components/icons';
import { cargarLeaderboard, type Leaderboard, type LeaderboardFila } from '@/lib/leaderboard';
import { etiquetaTemporada, mesesTemporada, nombreTemporada } from '@/lib/temporadas';
import { tiempoRelativo } from '@/lib/format';

const MEDALLAS: Record<number, { emoji: string; color: string; fondo: string }> = {
  1: { emoji: '🥇', color: '#F59E0B', fondo: 'rgba(245,158,11,.12)' },
  2: { emoji: '🥈', color: '#94A3B8', fondo: 'rgba(148,163,184,.14)' },
  3: { emoji: '🥉', color: '#B45309', fondo: 'rgba(180,83,9,.12)' },
};

function Fila({ f }: { f: LeaderboardFila }) {
  const medalla = MEDALLAS[f.posicion];
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all"
      style={
        f.es_tu
          ? { borderColor: '#8B5CF6', background: 'rgba(139,92,246,.06)' }
          : { borderColor: 'rgb(var(--linea))', background: 'rgb(var(--card))' }
      }
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
        <div className="mt-0.5 truncate text-xs text-slate3">
          {f.en_proceso > 0 && `${f.en_proceso} en proceso · `}
          {f.ultima_venta ? `última ${tiempoRelativo(f.ultima_venta)}` : 'sin ventas recientes'}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[17px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {f.ventas}
        </div>
        <div className="text-[10.5px] font-semibold text-slate3">
          {f.ventas === 1 ? 'venta' : 'ventas'}
        </div>
      </div>
    </div>
  );
}

function Podio({ f }: { f: LeaderboardFila }) {
  const medalla = MEDALLAS[f.posicion] ?? MEDALLAS[3];
  // El primer lugar sube un escalón, como en un podio de verdad
  const primero = f.posicion === 1;
  return (
    <div
      className="flex flex-col items-center rounded-[18px] border px-2 py-4 text-center"
      style={{
        borderColor: f.es_tu ? '#8B5CF6' : 'rgb(var(--linea))',
        background: f.es_tu ? 'rgba(139,92,246,.06)' : 'rgb(var(--card))',
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
        {f.ventas}
      </div>
      <div className="text-[10.5px] font-semibold text-slate3">
        {f.ventas === 1 ? 'venta' : 'ventas'}
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
  const [cargando, setCargando] = useState(inicial === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.temporada.clave === clave) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    cargarLeaderboard(clave || undefined)
      .then((d) => vivo && setData(d))
      .catch((e: Error) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const temporadas = data?.temporadas ?? [];
  const activa = data?.temporada.clave ?? clave;
  const tabla = data?.tabla ?? [];
  const yo = data?.yo ?? null;
  const podio = tabla.length >= 3 ? tabla.slice(0, 3) : [];
  const resto = podio.length ? tabla.slice(3) : tabla;

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
              {data.totales.ventas}
            </div>
            <div className="text-[11px] text-slate3">
              ventas · {data.totales.vendedores}{' '}
              {data.totales.vendedores === 1 ? 'vendedor' : 'vendedores'}
            </div>
          </div>
        )}
      </div>

      {/* Filtro por temporada */}
      {temporadas.length > 0 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
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
          {/* Tu posición */}
          {yo && (
            <div
              className="mt-4 rounded-[20px] p-[22px] text-white"
              style={{
                background:
                  yo.posicion === null
                    ? 'rgb(var(--tinta))'
                    : 'linear-gradient(135deg,#00D4FF,#8B5CF6)',
                boxShadow: yo.posicion === null ? undefined : '0 12px 32px rgba(139,92,246,.22)',
              }}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold tracking-[0.1em] opacity-85">
                    TU POSICIÓN
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[44px] font-extrabold leading-none tracking-tight">
                      {yo.posicion === null ? '—' : `#${yo.posicion}`}
                    </span>
                    {data.totales.vendedores > 0 && yo.posicion !== null && (
                      <span className="text-sm opacity-85">de {data.totales.vendedores}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[32px] font-extrabold leading-none">
                    <AnimatedNumber value={yo.ventas} prefix="" duration={700} />
                  </div>
                  <div className="text-[12.5px] opacity-85">
                    {yo.ventas === 1 ? 'venta cerrada' : 'ventas cerradas'}
                    {yo.en_proceso > 0 && ` · ${yo.en_proceso} en proceso`}
                  </div>
                </div>
              </div>

              <div className="mt-3.5 text-[13.5px] font-medium leading-snug opacity-95">
                {yo.posicion === null ? (
                  <>Todavía no entras al ranking. Tu primera venta cerrada te mete a la tabla. 🚀</>
                ) : yo.rival ? (
                  <>
                    Te {yo.rival.faltan === 1 ? 'falta' : 'faltan'}{' '}
                    <strong>
                      {yo.rival.faltan} {yo.rival.faltan === 1 ? 'venta' : 'ventas'}
                    </strong>{' '}
                    para alcanzar a {yo.rival.nombre.split(' ')[0]} (#{yo.rival.posicion}). 🔥
                  </>
                ) : (
                  <>Vas en la cima de la temporada. Nadie te ha alcanzado. 👑</>
                )}
              </div>

              {/* Avance de la temporada */}
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-700"
                    style={{ width: `${Math.round((data.temporada.progreso ?? 0) * 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11.5px] opacity-80">
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
                <Podio key={f.orden} f={f} />
              ))}
            </div>
          )}

          {/* Tabla */}
          {resto.length > 0 && (
            <div className="mt-3.5 flex flex-col gap-2">
              {resto.map((f) => (
                <Fila key={f.orden} f={f} />
              ))}
            </div>
          )}

          {/* Tú, cuando quedaste fuera del corte visible */}
          {yo && yo.posicion !== null && !yo.en_tabla && (
            <div className="mt-2">
              <div className="mb-2 text-center text-[11px] font-semibold text-slate3">···</div>
              <Fila
                f={{
                  orden: -1,
                  posicion: yo.posicion,
                  nombre: yo.nombre,
                  avatar_url: yo.avatar_url,
                  ventas: yo.ventas,
                  en_proceso: yo.en_proceso,
                  ultima_venta: null,
                  es_tu: true,
                }}
              />
            </div>
          )}

          {tabla.length === 0 && (
            <div className="mt-4 rounded-[20px] border border-dashed border-line bg-surface px-5 py-[52px] text-center">
              <div className="text-[38px]">🏁</div>
              <div className="mt-2.5 text-base font-bold">La temporada está en blanco</div>
              <div className="mt-1 text-sm text-slate2">
                Nadie ha cerrado una venta en {nombreTemporada(activa)}. Puedes ser el primero en
                aparecer aquí.
              </div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3">
            <Icon d={ICON_PATHS.shield} size={16} strokeWidth={2} stroke="rgb(var(--tinta3))" />
            <p className="text-[12px] leading-relaxed text-slate3">
              El ranking compara <strong>ventas cerradas</strong> (liberadas o pagadas), no dinero.
              Las comisiones de cada quien son privadas y nadie más las ve.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
