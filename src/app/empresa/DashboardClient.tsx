'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { WeeklyChart } from '@/components/WeeklyChart';
import { iniciales, telEnmascarado, tiempoRelativo } from '@/lib/format';
import type { Referido } from '@/lib/types';

export type ReferidoEmpresa = Referido & {
  freelancers: { nombre: string; codigo: string } | null;
};

export interface TopVendedor {
  nombre: string;
  codigo: string;
  ventas: number;
}

type Periodo = 'mes' | 'todo';

export function DashboardClient({
  empresaNombre,
  ofertaIds,
  referidosIniciales,
  nSuscritos,
}: {
  empresaNombre: string;
  ofertaIds: string[];
  referidosIniciales: ReferidoEmpresa[];
  nSuscritos: number;
}) {
  const [referidos, setReferidos] = useState<ReferidoEmpresa[]>(referidosIniciales);
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  // Realtime: los agentes registran referidos y aparecen aquí en vivo
  useEffect(() => {
    if (ofertaIds.length === 0) return;
    const supabase = supabaseBrowser();
    const canal = supabase
      .channel('referidos-empresa-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'rewards', table: 'referidos' },
        (payload) => {
          const row = payload.new as Referido;
          if (!row?.id || !ofertaIds.includes(row.oferta_id)) return;
          setReferidos((prev) => {
            const sin = prev.filter((r) => r.id !== row.id);
            const previo = prev.find((r) => r.id === row.id);
            return [{ ...row, freelancers: previo?.freelancers ?? null }, ...sin].sort(
              (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
            );
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ofertaIds)]);

  const mes = new Date();
  const mesLabel = mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  // Todo el panel (KPIs, gráfica, ranking y bitácora) mira el mismo periodo.
  const enPeriodo = useMemo(() => {
    if (periodo === 'todo') return referidos;
    return referidos.filter((r) => {
      const d = new Date(r.created_at);
      return d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referidos, periodo]);

  const suma = (estatus: string) =>
    enPeriodo.filter((r) => r.estatus === estatus).reduce((s, r) => s + Number(r.monto_mxn), 0);
  const pendientesMxn = suma('pendiente');
  const liberadasMxn = suma('liberado');

  // El ranking se calcula sobre lo que se está viendo, no sobre todo el histórico
  const topVendedores = useMemo(() => {
    const porVendedor = new Map<string, TopVendedor>();
    enPeriodo.forEach((r) => {
      const cur = porVendedor.get(r.codigo) ?? {
        nombre: r.freelancers?.nombre ?? r.codigo,
        codigo: r.codigo,
        ventas: 0,
      };
      cur.ventas += 1;
      porVendedor.set(r.codigo, cur);
    });
    return Array.from(porVendedor.values())
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 5);
  }, [enPeriodo]);

  const semanas = useMemo(() => {
    // 4 semanas del mes en curso
    const out = [1, 2, 3, 4].map((n) => ({ dia: `Sem ${n}`, valor: 0 }));
    enPeriodo.forEach((r) => {
      const d = new Date(r.created_at);
      if (d.getMonth() !== mes.getMonth() || d.getFullYear() !== mes.getFullYear()) return;
      const idx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
      out[idx].valor += 1;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enPeriodo]);

  const periodoLabel = periodo === 'mes' ? mesLabel : 'desde el inicio';

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-ink text-base font-extrabold text-white">
            {empresaNombre[0]}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{empresaNombre}</h1>
            <div className="text-[13px] text-slate2">
              Panel de empresa · {periodoLabel}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 rounded-xl border border-line bg-surface p-1">
          {(
            [
              ['mes', 'Este mes'],
              ['todo', 'Todo'],
            ] as [Periodo, string][]
          ).map(([v, txt]) => (
            <button
              key={v}
              onClick={() => setPeriodo(v)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                periodo === v ? 'bg-white text-ink shadow-sm' : 'text-slate3 hover:text-slate2'
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-[18px]">
          <div className="text-xs font-semibold text-slate3">Ventas por referidos</div>
          <div className="mt-1.5 text-[30px] font-extrabold">
            <AnimatedNumber value={enPeriodo.length} prefix="" />
          </div>
          <div className="mt-0.5 text-xs text-slate3">{periodoLabel}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-[18px]">
          <div className="text-xs font-semibold text-slate3">Pendientes</div>
          <div className="mt-1.5 text-[30px] font-extrabold text-amber1">
            <AnimatedNumber value={pendientesMxn} />
          </div>
          <div className="mt-0.5 text-xs text-slate3">esperando condición</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-[18px]">
          <div className="text-xs font-semibold text-slate3">Liberadas (a pagar)</div>
          <div className="mt-1.5 text-[30px] font-extrabold text-green1">
            <AnimatedNumber value={liberadasMxn} />
          </div>
          <div className="mt-0.5 text-xs text-slate3">comisiones por depositar</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-[18px]">
          <div className="text-xs font-semibold text-slate3">Freelancers suscritos</div>
          <div className="mt-1.5 text-[30px] font-extrabold">
            <AnimatedNumber value={nSuscritos} prefix="" />
          </div>
          <div className="mt-0.5 text-xs text-slate3">vendiendo tu oferta</div>
        </div>
      </div>

      {/* Gráfica + top vendedores */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-[1.4fr_1fr]">
        <div className="card p-[22px]">
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-bold">Referidos por semana</div>
            <div className="text-xs text-slate3">{mesLabel}</div>
          </div>
          <div className="mt-[18px]">
            <WeeklyChart data={semanas} height={150} showValues />
          </div>
        </div>
        <div className="card p-[22px]">
          <div className="mb-2 text-[15px] font-bold">Top vendedores</div>
          {topVendedores.length === 0 && (
            <div className="py-6 text-[13px] text-slate2">
              Aún no hay ventas. Cuando tus agentes registren referidos, verás el ranking aquí.
            </div>
          )}
          {topVendedores.map((t, i) => (
            <div
              key={t.codigo}
              className="flex items-center gap-3 border-b border-[#F1F5F9] py-2.5 last:border-b-0"
            >
              <div className="w-4 text-[13px] font-bold text-slate3">{i + 1}</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-white">
                {iniciales(t.nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.nombre}</div>
                <div className="text-xs text-slate3">{t.codigo}</div>
              </div>
              <div className="text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t.ventas}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conectado a los agentes Yaub */}
      <div className="mt-3.5 rounded-[20px] bg-ink p-[22px] text-line">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="h-[9px] w-[9px] rounded-full bg-green1"
              style={{ animation: 'pulseDot 1.6s ease infinite' }}
            />
            <div className="text-[15px] font-bold text-white">Conectado a tus agentes Yaub</div>
          </div>
          <div
            className="rounded-lg px-[11px] py-[5px] font-mono text-[11px] font-semibold"
            style={{ background: 'rgba(0,212,255,.12)', color: '#00D4FF' }}
          >
            tool: registrar_referido
          </div>
        </div>
        <div className="mt-1.5 text-[13px] text-slate3">
          Cuando un agente captura un código en cualquier conversación, el referido aparece aquí en
          tiempo real.
        </div>
        <div className="mt-4 flex flex-col gap-2 font-mono text-xs leading-normal">
          {enPeriodo.slice(0, 4).map((r) => (
            <div
              key={r.id}
              className="flex animate-floatIn flex-wrap items-baseline gap-2.5 rounded-[11px] px-3.5 py-2.5"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span className="shrink-0 font-semibold text-violet1">Agente {empresaNombre} →</span>
              <span className="break-all text-line">
                registrar_referido(codigo:{' '}
                <span className="font-semibold text-cyan1">{r.codigo}</span>, cliente:{' '}
                {telEnmascarado(r.cliente_telefono)})
              </span>
              <span className="shrink-0 text-green1">✓ guardado</span>
              <span className="ml-auto shrink-0 text-slate2">{tiempoRelativo(r.created_at)}</span>
            </div>
          ))}
          {enPeriodo.length === 0 && (
            <div
              className="rounded-[11px] px-3.5 py-2.5 text-slate3"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
            >
              Esperando el primer referido de tus agentes…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
