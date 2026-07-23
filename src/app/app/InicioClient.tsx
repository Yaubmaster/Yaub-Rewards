'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { WeeklyChart } from '@/components/WeeklyChart';
import { CodigoPill } from '@/components/CodigoBadge';
import { Icon, ICON_PATHS } from '@/components/icons';
import { telEnmascarado, tiempoRelativo } from '@/lib/format';
import type { Freelancer, Referido } from '@/lib/types';

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function InicioClient({
  freelancer,
  referidosIniciales,
}: {
  freelancer: Freelancer;
  referidosIniciales: Referido[];
}) {
  const [referidos, setReferidos] = useState<Referido[]>(referidosIniciales);
  const [nuevoId, setNuevoId] = useState<string | null>(null);

  // Realtime: referidos nuevos / actualizados entran en vivo con animación
  useEffect(() => {
    const supabase = supabaseBrowser();
    const canal = supabase
      .channel('referidos-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'rewards',
          table: 'referidos',
          filter: `freelancer_id=eq.${freelancer.id}`,
        },
        (payload) => {
          const nuevo = payload.new as Referido;
          setReferidos((prev) =>
            prev.some((r) => r.id === nuevo.id) ? prev : [nuevo, ...prev],
          );
          setNuevoId(nuevo.id);
          setTimeout(() => setNuevoId(null), 4000);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'rewards',
          table: 'referidos',
          filter: `freelancer_id=eq.${freelancer.id}`,
        },
        (payload) => {
          const upd = payload.new as Referido;
          setReferidos((prev) => prev.map((r) => (r.id === upd.id ? upd : r)));
          setNuevoId(upd.id);
          setTimeout(() => setNuevoId(null), 4000);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [freelancer.id]);

  const liberadas = useMemo(
    () =>
      referidos
        .filter((r) => r.estatus === 'liberado')
        .reduce((s, r) => s + Number(r.monto_mxn), 0),
    [referidos],
  );
  const pendientes = useMemo(
    () =>
      referidos
        .filter((r) => r.estatus === 'pendiente')
        .reduce((s, r) => s + Number(r.monto_mxn), 0),
    [referidos],
  );

  const semana = useMemo(() => {
    const hoy = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - (6 - i));
      const valor = referidos.filter((r) => {
        const rc = new Date(r.created_at);
        return rc.toDateString() === d.toDateString();
      }).length;
      return { dia: DIAS[d.getDay()], valor };
    });
  }, [referidos]);

  const actividad = useMemo(() => {
    const eventos = referidos.flatMap((r) => {
      const items: { id: string; texto: string; fecha: string; tipo: 'alta' | 'lib' }[] = [
        {
          id: `alta-${r.id}`,
          texto: `Nuevo referido con tu código: ${telEnmascarado(r.cliente_telefono)}`,
          fecha: r.created_at,
          tipo: 'alta',
        },
      ];
      if (r.liberado_at) {
        items.push({
          id: `lib-${r.id}`,
          texto: `Se liberaron $${Math.round(Number(r.monto_mxn))} — el referido cumplió: ${r.evento_liberacion ?? 'condición cumplida'}`,
          fecha: r.liberado_at,
          tipo: 'lib',
        });
      }
      return items;
    });
    return eventos.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha)).slice(0, 8);
  }, [referidos]);

  const nombreCorto = freelancer.nombre.split(' ')[0];

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Hola, {nombreCorto} 👋</h1>
          <p className="mt-0.5 text-sm text-slate2">Así van tus comisiones hoy.</p>
        </div>
        <CodigoPill codigo={freelancer.codigo} />
      </div>

      {/* Hero: liberadas vs pendientes */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-[1.3fr_1fr]">
        <div
          className="rounded-[20px] bg-badge p-6 text-white"
          style={{ boxShadow: '0 12px 32px rgba(139,92,246,.22)' }}
        >
          <div className="text-xs font-semibold tracking-[0.1em] opacity-85">
            GANANCIAS LIBERADAS
          </div>
          <div className="mt-1.5 text-[44px] font-extrabold tracking-tight">
            <AnimatedNumber value={liberadas} />
          </div>
          <div className="mt-0.5 text-[13px] opacity-85">MXN · listas para tu próximo pago</div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-[7px]">
            <span className="h-2 w-2 animate-pulseDot rounded-full bg-amber1" />
            <span className="text-xs font-semibold tracking-[0.1em] text-slate3">PENDIENTES</span>
          </div>
          <div className="mt-1.5 text-[44px] font-extrabold tracking-tight text-amber1">
            <AnimatedNumber value={pendientes} />
          </div>
          <div className="mt-0.5 text-[13px] text-slate2">Se liberan con la primera recarga</div>
        </div>
      </div>

      {/* Actividad semanal */}
      <div className="card mt-3.5 p-[22px]">
        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-bold">Actividad semanal</div>
          <div className="text-xs text-slate3">referidos por día</div>
        </div>
        <div className="mt-[18px]">
          <WeeklyChart data={semana} />
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="card mt-3.5 p-[22px]">
        <div className="mb-1.5 text-[15px] font-bold">Actividad reciente</div>
        <div className="flex flex-col">
          {actividad.length === 0 && (
            <div className="py-8 text-center">
              <div className="text-3xl">🪄</div>
              <div className="mt-2 text-sm font-semibold">Nada por aquí todavía</div>
              <div className="mt-1 text-[13px] text-slate2">
                Cuando alguien use tu código con un agente Yaub, lo verás aquí en vivo.
              </div>
            </div>
          )}
          {actividad.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 border-b border-[#F1F5F9] py-3 last:border-b-0"
              style={
                nuevoId && a.id.endsWith(nuevoId)
                  ? { animation: 'floatIn .4s ease', background: 'rgba(16,185,129,.05)', borderRadius: 12 }
                  : undefined
              }
            >
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                style={{
                  background: a.tipo === 'lib' ? 'rgba(16,185,129,.1)' : 'rgba(0,212,255,.12)',
                }}
              >
                <Icon
                  d={a.tipo === 'lib' ? ICON_PATHS.check : ICON_PATHS.user}
                  size={17}
                  strokeWidth={2}
                  stroke={a.tipo === 'lib' ? '#10B981' : '#0EA5E9'}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug">{a.texto}</div>
                <div className="mt-0.5 text-xs text-slate3">{tiempoRelativo(a.fecha)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
