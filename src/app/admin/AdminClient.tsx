'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { EstatusChip } from '@/components/Chips';
import { fechaCorta, fechaLarga, mxn, telEnmascarado } from '@/lib/format';
import type { Empresa, Pago, Referido } from '@/lib/types';

export type ReferidoAdmin = Referido & {
  freelancers: { nombre: string; codigo: string } | null;
  ofertas: { producto: string; empresas: { nombre: string } | null } | null;
};

export interface FreelancerResumen {
  id: string;
  nombre: string;
  codigo: string;
  clabe: string | null;
  activo: boolean;
  porPagar: number;
}

type Tab = 'empresas' | 'referidos' | 'pagos';

export function AdminClient({
  empresas,
  referidos,
  freelancers,
  pagos,
}: {
  empresas: Empresa[];
  referidos: ReferidoAdmin[];
  freelancers: FreelancerResumen[];
  pagos: (Pago & { freelancers: { nombre: string; codigo: string } | null })[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('empresas');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aprobar = async (empresaId: string) => {
    setError(null);
    setOcupado(empresaId);
    const { error: err } = await supabaseBrowser().rpc('aprobar_empresa', {
      p_empresa_id: empresaId,
    });
    setOcupado(null);
    if (err) {
      setError('No se pudo aprobar la empresa.');
      return;
    }
    router.refresh();
  };

  const marcarPago = async (freelancerId: string) => {
    setError(null);
    setOcupado(freelancerId);
    const { error: err } = await supabaseBrowser().rpc('marcar_pago', {
      p_freelancer_id: freelancerId,
      p_metodo: 'transferencia',
      p_notas: 'Depósito de comisiones liberadas',
    });
    setOcupado(null);
    if (err) {
      setError('No se pudo marcar el pago (¿tiene comisiones liberadas?).');
      return;
    }
    router.refresh();
  };

  const tabs: { k: Tab; label: string }[] = [
    { k: 'empresas', label: `Empresas (${empresas.filter((e) => e.estado === 'en_revision').length} por revisar)` },
    { k: 'referidos', label: 'Referidos' },
    { k: 'pagos', label: 'Pagos' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[960px] p-4 md:px-8 md:py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/yaub-icon.png" alt="Yaub" width={30} height={30} className="h-[30px] w-auto" />
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight">Admin · Yaub Rewards</h1>
              <div className="text-xs text-slate3">Aprobación de empresas, referidos y pagos</div>
            </div>
          </div>
          <Link href="/" className="text-[13px] font-semibold text-[#0EA5E9] hover:text-violet1">
            Salir
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="rounded-full border px-[15px] py-2 text-[13px] font-semibold transition-all"
              style={
                tab === t.k
                  ? { background: '#0A0A0F', color: '#fff', borderColor: '#0A0A0F' }
                  : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}

        {tab === 'empresas' && (
          <div className="mt-5 flex flex-col gap-2.5">
            {empresas.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-[15px]"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[15px] font-extrabold"
                  style={
                    e.estado === 'autorizada'
                      ? { background: '#0A0A0F', color: '#fff' }
                      : { background: 'rgba(245,158,11,.14)', color: '#F59E0B' }
                  }
                >
                  {e.nombre[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{e.nombre}</div>
                  <div className="text-xs text-slate3">
                    {e.descripcion ?? 'Sin descripción'} · {fechaLarga(e.created_at)}
                  </div>
                </div>
                {e.estado === 'autorizada' ? (
                  <span className="rounded-full bg-[rgba(16,185,129,.1)] px-[11px] py-1 text-[11px] font-semibold text-green1">
                    Autorizada
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-[rgba(245,158,11,.12)] px-[11px] py-1 text-[11px] font-semibold text-amber1">
                      En revisión
                    </span>
                    <button
                      onClick={() => aprobar(e.id)}
                      disabled={ocupado === e.id}
                      className="btn-gradient px-4 py-2 text-xs disabled:opacity-60"
                    >
                      {ocupado === e.id ? 'Aprobando…' : 'Aprobar'}
                    </button>
                  </>
                )}
              </div>
            ))}
            {empresas.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-line bg-surface p-8 text-center text-sm text-slate2">
                No hay empresas registradas.
              </div>
            )}
          </div>
        )}

        {tab === 'referidos' && (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left text-xs font-semibold text-slate3">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estatus</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {referidos.map((r) => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] last:border-b-0">
                    <td className="px-4 py-3 font-medium">{telEnmascarado(r.cliente_telefono)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.codigo}</td>
                    <td className="px-4 py-3">{r.freelancers?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">{r.ofertas?.empresas?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-bold">${Math.round(Number(r.monto_mxn))}</td>
                    <td className="px-4 py-3">
                      <EstatusChip estatus={r.estatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate3">{fechaCorta(r.created_at)}</td>
                  </tr>
                ))}
                {referidos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate2">
                      Sin referidos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pagos' && (
          <div className="mt-5 flex flex-col gap-6">
            <div>
              <h2 className="text-[15px] font-bold">Por pagar (comisiones liberadas)</h2>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {freelancers
                  .filter((f) => f.porPagar > 0)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-[15px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">
                          {f.nombre} <span className="font-mono text-xs text-slate3">{f.codigo}</span>
                        </div>
                        <div className="mt-px text-xs text-slate3">
                          {f.clabe ? `CLABE ${f.clabe}` : '⚠ Sin CLABE registrada'}
                        </div>
                      </div>
                      <div className="text-[15px] font-bold text-green1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {mxn(f.porPagar)}
                      </div>
                      <button
                        onClick={() => marcarPago(f.id)}
                        disabled={ocupado === f.id}
                        className="rounded-[10px] bg-green1 px-3.5 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px active:scale-95 disabled:opacity-60"
                      >
                        {ocupado === f.id ? 'Marcando…' : 'Marcar pagado'}
                      </button>
                    </div>
                  ))}
                {freelancers.every((f) => f.porPagar === 0) && (
                  <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-slate2">
                    Nadie tiene comisiones liberadas pendientes de pago.
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-bold">Historial de pagos</h2>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {pagos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {p.freelancers?.nombre ?? '—'}{' '}
                        <span className="font-mono text-xs text-slate3">{p.freelancers?.codigo}</span>
                      </div>
                      <div className="mt-px text-xs text-slate3">{fechaLarga(p.created_at)}</div>
                    </div>
                    <span className="text-[15px] font-bold text-green1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      +{mxn(Number(p.monto_mxn))}
                    </span>
                  </div>
                ))}
                {pagos.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-slate2">
                    Sin pagos registrados.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
