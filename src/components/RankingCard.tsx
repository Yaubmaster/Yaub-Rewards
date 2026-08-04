'use client';

// Enganche del leaderboard en el dashboard del vendedor: en qué lugar va esta
// temporada y a quién trae enfrente, con link a la tabla completa.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Icon, ICON_PATHS } from '@/components/icons';
import { cargarLeaderboard, type Leaderboard } from '@/lib/leaderboard';
import { nombreTemporada } from '@/lib/temporadas';

export function RankingCard() {
  const [data, setData] = useState<Leaderboard | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarLeaderboard()
      .then((d) => vivo && setData(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!data?.yo) return null;
  const { yo, temporada, totales } = data;
  const podio = data.tabla.slice(0, 3);

  return (
    <Link
      href="/app/leaderboard"
      className="card mt-3.5 block p-[22px] transition-all hover:-translate-y-px hover:border-violet1"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(139,92,246,.12)' }}
          >
            <Icon d={ICON_PATHS.trofeo} size={18} strokeWidth={2} stroke="#8B5CF6" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold">Ranking de la temporada</div>
            <div className="truncate text-xs text-slate3">
              {nombreTemporada(temporada.clave)}
              {temporada.actual && ` · quedan ${temporada.dias_restantes} días`}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[12.5px] font-bold text-violet1">Ver tabla →</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[34px] font-extrabold leading-none tracking-tight">
            {yo.posicion === null ? '—' : `#${yo.posicion}`}
          </span>
          <span className="text-[13px] text-slate2">
            {yo.posicion === null
              ? 'aún sin ranking'
              : `de ${totales.vendedores} · ${yo.ventas} ${yo.ventas === 1 ? 'venta' : 'ventas'}`}
          </span>
        </div>

        {podio.length > 0 && (
          <div className="flex items-center gap-3">
            {podio.map((f, i) => (
              <div key={f.orden} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <Avatar url={f.avatar_url} nombre={f.nombre} size={30} forma="circulo" />
                  <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                    {['🥇', '🥈', '🥉'][i]}
                  </span>
                </div>
                <span
                  className="text-[11px] font-bold text-slate2"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {f.ventas}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-[13px] font-medium text-slate2">
        {yo.posicion === null
          ? 'Tu primera venta cerrada te mete a la tabla. 🚀'
          : yo.rival
            ? `Te ${yo.rival.faltan === 1 ? 'falta' : 'faltan'} ${yo.rival.faltan} ${
                yo.rival.faltan === 1 ? 'venta' : 'ventas'
              } para alcanzar a ${yo.rival.nombre.split(' ')[0]}. 🔥`
            : 'Vas #1 de la temporada. 👑'}
      </div>
    </Link>
  );
}
