'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CAPACITACION_LABELS, CONDICION_LABELS, type CapacitacionTipo } from '@/lib/types';

export interface EmpresaMarketplace {
  id: string;
  nombre: string;
  descripcion: string | null;
  ofertas: {
    id: string;
    producto: string;
    descripcion: string | null;
    precio_mxn: number | null;
    fotos: string[];
    comision_mxn: number;
    condicion_liberacion: string | null;
    capacitacion: CapacitacionTipo;
    activa: boolean;
  }[];
}

export function EmpresasClient({
  empresas,
  suscritas,
  freelancerId,
  modulosPorEmpresa,
}: {
  empresas: EmpresaMarketplace[];
  suscritas: string[];
  freelancerId: string;
  modulosPorEmpresa: Record<string, number>;
}) {
  const [subs, setSubs] = useState<Set<string>>(new Set(suscritas));
  const [ocupado, setOcupado] = useState<string | null>(null);

  const toggle = async (empresaId: string) => {
    const supabase = supabaseBrowser();
    setOcupado(empresaId);
    if (subs.has(empresaId)) {
      const { error } = await supabase
        .from('suscripciones')
        .delete()
        .eq('freelancer_id', freelancerId)
        .eq('empresa_id', empresaId);
      if (!error) {
        setSubs((s) => {
          const n = new Set(s);
          n.delete(empresaId);
          return n;
        });
      }
    } else {
      const { error } = await supabase
        .from('suscripciones')
        .upsert(
          { freelancer_id: freelancerId, empresa_id: empresaId },
          { onConflict: 'freelancer_id,empresa_id', ignoreDuplicates: true },
        );
      if (!error) setSubs((s) => new Set(s).add(empresaId));
    }
    setOcupado(null);
  };

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[26px] font-extrabold tracking-tight">Empresas</h1>
      <p className="mt-0.5 text-sm text-slate2">
        Marketplace de empresas autorizadas. Suscríbete, pasa su capacitación y empieza a referir.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {empresas.map((e) => {
          const oferta = e.ofertas.find((o) => o.activa) ?? e.ofertas[0];
          const on = subs.has(e.id);
          const destacada = e.nombre === 'Yaub Móvil';
          const nModulos = modulosPorEmpresa[e.id] ?? 0;
          const foto = oferta?.fotos?.[0];
          const condicion = oferta?.condicion_liberacion
            ? CONDICION_LABELS[oferta.condicion_liberacion] ?? oferta.condicion_liberacion
            : '—';
          return (
            <div
              key={e.id}
              className="relative flex flex-col overflow-hidden rounded-[20px] border bg-white transition-all hover:-translate-y-0.5"
              style={{
                borderColor: destacada ? 'rgba(139,92,246,.45)' : '#E2E8F0',
                boxShadow: destacada
                  ? '0 10px 30px rgba(139,92,246,.12)'
                  : '0 2px 8px rgba(10,10,15,.04)',
              }}
            >
              {foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={oferta?.producto ?? e.nombre} className="h-36 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-5">
                {destacada && (
                  <div className="absolute right-3.5 top-3.5 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-white">
                    DESTACADA
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] text-base font-extrabold"
                    style={
                      destacada
                        ? { background: '#0A0A0F', color: '#fff' }
                        : { background: 'rgba(14,165,233,.12)', color: '#0EA5E9' }
                    }
                  >
                    {e.nombre[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate3">{e.nombre}</div>
                    <div className="truncate text-base font-bold">
                      {oferta?.producto ?? 'Sin oferta activa'}
                    </div>
                  </div>
                </div>

                {(oferta?.descripcion || e.descripcion) && (
                  <p className="mt-2.5 text-[13px] leading-relaxed text-slate2">
                    {oferta?.descripcion ?? e.descripcion}
                  </p>
                )}

                <div className="mt-3.5 flex flex-col gap-[7px] rounded-xl bg-surface p-3">
                  {oferta?.precio_mxn != null && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-slate3">Precio al cliente</span>
                      <span className="font-semibold">${Math.round(Number(oferta.precio_mxn))} MXN</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate3">Tu comisión</span>
                    <span className="text-gradient font-bold">
                      {oferta ? `$${Math.round(oferta.comision_mxn)} MXN` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2.5 text-[13px]">
                    <span className="shrink-0 text-slate3">Se libera</span>
                    <span className="text-right font-medium">{condicion}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate3">Capacitación</span>
                    <span
                      className="font-semibold"
                      style={{ color: oferta?.capacitacion === 'presencial' ? '#F59E0B' : '#0EA5E9' }}
                    >
                      {oferta ? CAPACITACION_LABELS[oferta.capacitacion] : '—'}
                      {nModulos > 0 ? ` · ${nModulos} video${nModulos === 1 ? '' : 's'}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex-1" />

                <button
                  onClick={() => toggle(e.id)}
                  disabled={ocupado === e.id}
                  className="mt-3.5 w-full rounded-[13px] border py-3 text-center text-sm font-bold transition-all active:scale-[.98] disabled:opacity-60"
                  style={
                    on
                      ? { background: '#fff', color: '#10B981', borderColor: 'rgba(16,185,129,.4)' }
                      : {
                          background: 'linear-gradient(135deg,#00D4FF,#8B5CF6)',
                          color: '#fff',
                          borderColor: 'transparent',
                        }
                  }
                >
                  {on ? '✓ Suscrito' : 'Suscribirme'}
                </button>

                {on && nModulos > 0 && (
                  <div className="mt-2.5 animate-floatIn rounded-[10px] bg-[rgba(16,185,129,.08)] px-3 py-[9px] text-xs text-slate2">
                    📚 Pasa los <b>{nModulos} módulo{nModulos === 1 ? '' : 's'} de capacitación</b>{' '}
                    para volverte vendedor certificado — están en la pestaña Capacitación.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {empresas.length === 0 && (
        <div className="mt-5 rounded-[20px] border border-dashed border-line bg-surface p-10 text-center text-sm text-slate2">
          Aún no hay empresas autorizadas en el marketplace.
        </div>
      )}
    </div>
  );
}
