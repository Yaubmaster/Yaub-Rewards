'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useCopiar } from '@/components/CodigoBadge';
import { Icon, ICON_PATHS } from '@/components/icons';
import { fechaLarga, iniciales, mxn } from '@/lib/format';
import type { Freelancer, Pago } from '@/lib/types';

export function PerfilClient({
  freelancer,
  pagos,
  totalHistorico,
}: {
  freelancer: Freelancer;
  pagos: Pago[];
  totalHistorico: number;
}) {
  const { copiado, copiar } = useCopiar(freelancer.codigo);
  const [editando, setEditando] = useState(false);
  const [clabe, setClabe] = useState(freelancer.clabe ?? '');
  const [clabeGuardada, setClabeGuardada] = useState(freelancer.clabe ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardarClabe = async () => {
    const limpia = clabe.replace(/\s/g, '');
    if (limpia && !/^\d{18}$/.test(limpia)) {
      setError('La CLABE debe tener 18 dígitos.');
      return;
    }
    setError(null);
    setGuardando(true);
    const { error: err } = await supabaseBrowser()
      .from('freelancers')
      .update({ clabe: limpia || null })
      .eq('id', freelancer.id);
    setGuardando(false);
    if (err) {
      setError('No se pudo guardar. Intenta de nuevo.');
      return;
    }
    setClabeGuardada(limpia);
    setEditando(false);
  };

  const clabeFmt = clabeGuardada
    ? `${clabeGuardada.slice(0, 3)} ${clabeGuardada.slice(3, 6)} ••••• ••• ${clabeGuardada.slice(-4)}`
    : null;

  return (
    <div className="animate-fadeUpFast">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-badge text-[22px] font-extrabold text-white">
          {iniciales(freelancer.nombre)}
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">{freelancer.nombre}</h1>
          <div className="text-[13px] text-slate2">
            {freelancer.telefono ? `${freelancer.telefono} · ` : ''}desde{' '}
            {fechaLarga(freelancer.created_at)}
          </div>
        </div>
      </div>

      <div className="mt-[22px] grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[18px] border border-line bg-white p-5">
          <div className="text-xs font-semibold tracking-[0.08em] text-slate3">MI CÓDIGO</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-gradient text-[30px] font-extrabold">{freelancer.codigo}</span>
            <button
              onClick={copiar}
              className="rounded-[10px] border border-line px-[13px] py-[7px] text-xs font-semibold transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
            >
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
        <div className="rounded-[18px] border border-line bg-white p-5">
          <div className="text-xs font-semibold tracking-[0.08em] text-slate3">TOTAL HISTÓRICO</div>
          <div className="mt-2 text-[30px] font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {mxn(totalHistorico)} <span className="text-sm font-semibold text-slate3">MXN</span>
          </div>
        </div>
      </div>

      {/* Cuenta para depósitos */}
      <div className="mt-3.5 rounded-[18px] border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-bold">Cuenta para depósitos</div>
          {!editando && (
            <button
              onClick={() => {
                setClabe(clabeGuardada);
                setEditando(true);
              }}
              className="text-xs font-semibold text-[#0EA5E9] transition-colors hover:text-violet1"
            >
              {clabeGuardada ? 'Editar' : 'Agregar CLABE'}
            </button>
          )}
        </div>

        {editando ? (
          <div className="mt-3.5">
            <input
              className="input-yaub"
              placeholder="CLABE interbancaria (18 dígitos)"
              value={clabe}
              onChange={(e) => setClabe(e.target.value)}
              inputMode="numeric"
              maxLength={22}
            />
            {error && <p className="mt-2 text-[13px] font-medium text-red-500">{error}</p>}
            <div className="mt-3 flex gap-2.5">
              <button
                onClick={guardarClabe}
                disabled={guardando}
                className="btn-gradient px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditando(false)}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-slate2"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : clabeFmt ? (
          <div className="mt-3.5 flex items-center gap-3 rounded-xl bg-surface p-3.5">
            <Icon d={ICON_PATHS.bank} stroke="#475569" />
            <div>
              <div className="text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                CLABE {clabeFmt}
              </div>
              <div className="text-xs text-slate3">{freelancer.nombre}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 rounded-xl border border-dashed border-line bg-surface p-3.5 text-[13px] text-slate2">
            Agrega tu CLABE para recibir tus depósitos de comisiones.
          </div>
        )}
      </div>

      {/* Segunda oficina: perfil de empresa */}
      <div className="mt-3.5 rounded-[18px] border border-dashed border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold">¿Tienes un negocio?</div>
            <div className="mt-0.5 text-[13px] text-slate2">
              Crea tu perfil de empresa con esta misma cuenta y arma tu red de vendedores.
            </div>
          </div>
          <a
            href="/rewards/registro/empresa"
            className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-px"
          >
            Crear perfil de empresa
          </a>
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="mt-3.5 rounded-[18px] border border-line bg-white p-5">
        <div className="mb-1 text-[15px] font-bold">Historial de pagos</div>
        {pagos.length === 0 && (
          <div className="py-4 text-[13px] text-slate2">
            Aún no tienes pagos. Tus comisiones liberadas se depositan en el siguiente corte.
          </div>
        )}
        {pagos.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-b border-[#F1F5F9] py-[13px] last:border-b-0"
          >
            <div>
              <div className="text-sm font-semibold">
                {p.notas ?? `Depósito · ${p.metodo ?? 'transferencia'}`}
              </div>
              <div className="mt-px text-xs text-slate3">{fechaLarga(p.created_at)}</div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-bold text-green1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                +{mxn(Number(p.monto_mxn))}
              </span>
              <span className="rounded-full bg-[rgba(16,185,129,.1)] px-[9px] py-[3px] text-[11px] font-semibold text-green1">
                Pagado
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
