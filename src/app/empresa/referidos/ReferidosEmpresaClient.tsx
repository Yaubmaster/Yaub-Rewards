'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { EstatusChip } from '@/components/Chips';
import { fechaCorta, telEnmascarado } from '@/lib/format';
import type { Referido } from '@/lib/types';
import type { ReferidoEmpresa } from '../DashboardClient';

const CONDICION_BOTON: Record<string, string> = {
  primera_recarga: '✓ Primera recarga',
};

export function ReferidosEmpresaClient({
  referidosIniciales,
  condicion,
}: {
  referidosIniciales: ReferidoEmpresa[];
  condicion: string;
}) {
  const [referidos, setReferidos] = useState<ReferidoEmpresa[]>(referidosIniciales);
  const [flash, setFlash] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const etiquetaBoton = CONDICION_BOTON[condicion] ?? '✓ Condición cumplida';

  const liberar = async (id: string) => {
    setError(null);
    setOcupado(id);
    const { data, error: err } = await supabaseBrowser()
      .rpc('liberar_referido', { p_referido_id: id, p_evento: condicion })
      .single();
    setOcupado(null);
    if (err || !data) {
      setError('No se pudo liberar la comisión. Intenta de nuevo.');
      return;
    }
    const upd = data as Referido;
    setReferidos((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...upd, freelancers: r.freelancers } : r)),
    );
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  };

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[26px] font-extrabold tracking-tight">Referidos</h1>
      <p className="mt-0.5 text-sm text-slate2">
        Ventas capturadas por tus agentes Yaub. Marca la condición cumplida para liberar la
        comisión.
      </p>

      {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}

      <div className="mt-[18px] flex flex-col gap-2.5">
        {referidos.map((r) => {
          const conFlash = flash === r.id;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3.5 rounded-2xl border px-4 py-[15px] transition-all duration-500"
              style={{
                background: conFlash ? 'rgba(16,185,129,.08)' : '#fff',
                borderColor: conFlash ? 'rgba(16,185,129,.5)' : '#E2E8F0',
              }}
            >
              <div className="min-w-[150px] flex-1">
                <div className="text-sm font-semibold">{telEnmascarado(r.cliente_telefono)}</div>
                <div className="mt-px text-xs text-slate3">
                  {fechaCorta(r.created_at)} · {r.evento_alta ?? 'referido'}
                  {r.freelancers?.nombre ? ` · por ${r.freelancers.nombre}` : ''}
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-line bg-surface px-[11px] py-[5px] font-mono text-xs font-semibold">
                {r.codigo}
              </div>
              <div className="shrink-0 text-[15px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ${Math.round(Number(r.monto_mxn))}
              </div>
              <EstatusChip estatus={r.estatus} />
              {r.estatus === 'pendiente' && (
                <button
                  onClick={() => liberar(r.id)}
                  disabled={ocupado === r.id}
                  className="shrink-0 rounded-[10px] bg-green1 px-3.5 py-2 text-xs font-bold text-white transition-all hover:-translate-y-px hover:shadow-[0_6px_14px_rgba(16,185,129,.3)] active:scale-95 disabled:opacity-60"
                >
                  {ocupado === r.id ? 'Liberando…' : etiquetaBoton}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {referidos.length === 0 && (
        <div className="mt-[18px] rounded-[20px] border border-dashed border-line bg-surface p-10 text-center">
          <div className="text-3xl">🤖</div>
          <div className="mt-2 text-sm font-semibold">Sin referidos todavía</div>
          <div className="mt-1 text-[13px] text-slate2">
            Cuando tus agentes Yaub registren ventas con código de vendedor, aparecerán aquí.
          </div>
        </div>
      )}
    </div>
  );
}
