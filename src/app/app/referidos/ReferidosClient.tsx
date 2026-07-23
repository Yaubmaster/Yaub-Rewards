'use client';

import { useState } from 'react';
import { EstatusChip } from '@/components/Chips';
import { useCopiar } from '@/components/CodigoBadge';
import { fechaCorta, telEnmascarado } from '@/lib/format';
import type { Referido, ReferidoEstatus } from '@/lib/types';

export type ReferidoConEmpresa = Referido & {
  ofertas: { producto: string; empresas: { nombre: string } | null } | null;
};

const FILTROS: { k: 'todos' | ReferidoEstatus; label: string }[] = [
  { k: 'todos', label: 'Todos' },
  { k: 'pendiente', label: 'Pendientes' },
  { k: 'liberado', label: 'Liberados' },
  { k: 'pagado', label: 'Pagados' },
];

export function ReferidosClient({
  referidos,
  codigo,
}: {
  referidos: ReferidoConEmpresa[];
  codigo: string;
}) {
  const [filtro, setFiltro] = useState<'todos' | ReferidoEstatus>('todos');
  const { copiado, copiar } = useCopiar(codigo);

  const filtrados = referidos.filter((r) => filtro === 'todos' || r.estatus === filtro);

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[26px] font-extrabold tracking-tight">Referidos</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const on = filtro === f.k;
          return (
            <button
              key={f.k}
              onClick={() => setFiltro(f.k)}
              className="rounded-full border px-[15px] py-2 text-[13px] font-semibold transition-all"
              style={
                on
                  ? { background: '#0A0A0F', color: '#fff', borderColor: '#0A0A0F' }
                  : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] flex flex-col gap-2.5">
        {filtrados.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-[15px] transition-all hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(10,10,15,.06)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-badge text-sm font-bold text-white">
              {r.cliente_telefono.replace(/\D/g, '').slice(-2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {telEnmascarado(r.cliente_telefono)}{' '}
                <span className="text-[13px] font-normal text-slate3">· {r.evento_alta ?? 'referido'}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate3">
                {r.ofertas?.empresas?.nombre ?? 'Yaub Móvil'} · {fechaCorta(r.created_at)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[15px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ${Math.round(Number(r.monto_mxn))}
              </div>
              <div className="mt-1">
                <EstatusChip estatus={r.estatus} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="mt-[18px] rounded-[20px] border border-dashed border-line bg-surface px-5 py-[52px] text-center">
          <div className="text-[38px]">🪄</div>
          <div className="mt-2.5 text-base font-bold">Nada por aquí todavía</div>
          <div className="mt-1 text-sm text-slate2">
            Cuando alguien use tu código con un agente Yaub, aparecerá aquí.
          </div>
          <button onClick={copiar} className="btn-gradient mt-4 inline-block px-[22px] py-[11px] text-sm">
            {copiado ? '✓ Código copiado' : 'Comparte tu código'}
          </button>
        </div>
      )}
    </div>
  );
}
