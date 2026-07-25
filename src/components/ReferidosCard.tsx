'use client';

// Tarjeta gamificada "Mis referidos" del dashboard del vendedor:
// · Comparte tu código (copiar link + WhatsApp con mensaje pre-armado)
// · Progreso por referido: "2/3 comisiones — te falta 1 para liberar $100"
// · Celebración (confetti + count-up) cuando un bono se libera, vía realtime
// · Badges por hitos: 1er referido, 3 y 5 referidos
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Confetti } from '@/components/Confetti';
import { useCopiar } from '@/components/CodigoBadge';
import { Icon, ICON_PATHS } from '@/components/icons';
import { iniciales } from '@/lib/format';

interface ReferidoMio {
  id: string;
  nombre: string;
  comisiones_pagadas: number;
  estatus: 'pendiente' | 'liberado';
  monto_mxn: number;
  pagado: boolean;
  liberado_at: string | null;
  created_at: string;
}

interface MiBono {
  referrer_nombre: string;
  comisiones_pagadas: number;
  estatus: 'pendiente' | 'liberado';
  monto_mxn: number;
  pagado: boolean;
  liberado_at: string | null;
}

interface Resumen {
  como_referrer: ReferidoMio[];
  como_referido: MiBono | null;
}

function linkInvitacion(codigo: string) {
  // La app vive bajo basePath /rewards (rewards.yaub.ai/rewards/... y yaub.ai/rewards/...)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rewards.yaub.ai';
  return `${base}/rewards/registro/freelancer?ref=${encodeURIComponent(codigo)}`;
}

function mensajeInvitacionVendedor(codigo: string) {
  const texto = `Estoy ganando comisiones vendiendo con Yaub Rewards 💸 Regístrate como vendedor con mi código *${codigo}* y arrancas con $50 MXN de bono: ${linkInvitacion(codigo)}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

const HITOS = [
  { n: 1, label: '1er referido' },
  { n: 3, label: '3 referidos' },
  { n: 5, label: '5 referidos' },
];

export function ReferidosCard({
  freelancerId,
  codigo,
}: {
  freelancerId: string;
  codigo: string;
}) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [celebrar, setCelebrar] = useState(false);
  const liberadosPrevios = useRef<Set<string> | null>(null);
  const { copiado, copiar } = useCopiar(linkInvitacion(codigo));

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.rpc('mis_referidos_resumen');
    if (!data) return;
    const r = data as unknown as Resumen;

    // Celebración: algún bono pasó a liberado desde la última carga
    const liberadosAhora = new Set(
      r.como_referrer.filter((x) => x.estatus === 'liberado').map((x) => x.id),
    );
    if (r.como_referido?.estatus === 'liberado') liberadosAhora.add('mi-bono');
    if (liberadosPrevios.current) {
      const previos = liberadosPrevios.current;
      if (Array.from(liberadosAhora).some((id) => !previos.has(id))) {
        setCelebrar(true);
      }
    }
    liberadosPrevios.current = liberadosAhora;
    setResumen(r);
  }, []);

  useEffect(() => {
    cargar();
    const supabase = supabaseBrowser();
    const canal = supabase
      .channel('bonos-referidos-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'rewards',
          table: 'freelancer_referidos',
          filter: `referrer_freelancer_id=eq.${freelancerId}`,
        },
        () => cargar(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'rewards',
          table: 'freelancer_referidos',
          filter: `referred_freelancer_id=eq.${freelancerId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [freelancerId, cargar]);

  const referidos = resumen?.como_referrer ?? [];
  const miBono = resumen?.como_referido ?? null;
  const totalPendiente =
    referidos.filter((r) => r.estatus === 'pendiente').reduce((s, r) => s + Number(r.monto_mxn), 0) +
    (miBono && miBono.estatus === 'pendiente' ? Number(miBono.monto_mxn) : 0);

  return (
    <div className="card mt-3.5 p-[22px]">
      {celebrar && <Confetti onFin={() => setCelebrar(false)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-bold">Mis referidos 🎯</div>
          <div className="mt-0.5 text-xs text-slate3">
            Invita vendedores: tú ganas <b>$100</b> y ellos <b>$50</b> cuando cobren su 3ª comisión
          </div>
        </div>
        {totalPendiente > 0 && (
          <div className="rounded-xl bg-[rgba(245,158,11,.1)] px-3 py-1.5 text-right">
            <div className="text-[10px] font-bold tracking-wide text-[#B45309]">POR LIBERAR</div>
            <div className="text-lg font-extrabold text-amber1">
              $<AnimatedNumber value={totalPendiente} />
            </div>
          </div>
        )}
      </div>

      {/* Badges por hitos */}
      <div className="mt-3.5 flex gap-2">
        {HITOS.map((h) => {
          const logrado = referidos.length >= h.n;
          return (
            <div
              key={h.n}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold"
              style={
                logrado
                  ? { background: 'rgba(139,92,246,.1)', borderColor: 'rgba(139,92,246,.35)', color: '#7C3AED' }
                  : { background: '#F8FAFC', borderColor: '#E2E8F0', color: '#94A3B8' }
              }
            >
              <Icon d={ICON_PATHS.medal} size={13} strokeWidth={2.2} stroke={logrado ? '#7C3AED' : '#94A3B8'} />
              {h.label}
            </div>
          );
        })}
      </div>

      {/* Mi propio bono de bienvenida (si me refirieron) */}
      {miBono && !miBono.pagado && (
        <div
          className="mt-3.5 rounded-2xl border px-4 py-3"
          style={
            miBono.estatus === 'liberado'
              ? { background: 'rgba(16,185,129,.07)', borderColor: 'rgba(16,185,129,.35)' }
              : { background: 'rgba(0,212,255,.06)', borderColor: 'rgba(0,212,255,.3)' }
          }
        >
          <div className="text-[13px] font-bold">
            {miBono.estatus === 'liberado' ? (
              <>🎉 ¡Tu bono de ${Math.round(Number(miBono.monto_mxn))} está liberado!</>
            ) : (
              <>🎁 Tienes ${Math.round(Number(miBono.monto_mxn))} de bono por ser referido de {miBono.referrer_nombre}</>
            )}
          </div>
          {miBono.estatus === 'pendiente' && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-badge transition-all duration-700"
                  style={{ width: `${(miBono.comisiones_pagadas / 3) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 text-[12px] font-medium text-slate2">
                {miBono.comisiones_pagadas}/3 comisiones cobradas — te{' '}
                {3 - miBono.comisiones_pagadas === 1 ? 'falta 1' : `faltan ${3 - miBono.comisiones_pagadas}`}{' '}
                para liberarlo
              </div>
            </>
          )}
        </div>
      )}

      {/* Progreso de cada referido mío */}
      {referidos.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {referidos.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-surface/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-badge text-[12px] font-extrabold text-white">
                  {iniciales(r.nombre)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{r.nombre}</div>
                  {r.estatus === 'pendiente' ? (
                    <div className="text-[12px] text-slate2">
                      {r.comisiones_pagadas}/3 comisiones — te{' '}
                      {3 - r.comisiones_pagadas === 1 ? 'falta 1' : `faltan ${3 - r.comisiones_pagadas}`}{' '}
                      para liberar ${Math.round(Number(r.monto_mxn))}
                    </div>
                  ) : (
                    <div className="text-[12px] font-semibold text-green1">
                      {r.pagado ? `Bono de $${Math.round(Number(r.monto_mxn))} pagado ✓` : `¡$${Math.round(Number(r.monto_mxn))} liberados! 🎉`}
                    </div>
                  )}
                </div>
                <div
                  className="shrink-0 text-[15px] font-extrabold"
                  style={{ color: r.estatus === 'liberado' ? '#10B981' : '#F59E0B' }}
                >
                  $<AnimatedNumber value={Number(r.monto_mxn)} />
                </div>
              </div>
              {r.estatus === 'pendiente' && (
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-badge transition-all duration-700"
                    style={{ width: `${Math.max(4, (r.comisiones_pagadas / 3) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comparte tu código */}
      <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-3.5">
        <div className="text-[13px] font-bold">Comparte tu código</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-gradient rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-extrabold tracking-wide">
            {codigo}
          </span>
          <button
            onClick={copiar}
            className="rounded-xl border border-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0284C7]"
          >
            {copiado ? '✓ Link copiado' : 'Copiar link'}
          </button>
          <a
            href={mensajeInvitacionVendedor(codigo)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95"
            style={{ background: '#25D366' }}
          >
            Compartir por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
