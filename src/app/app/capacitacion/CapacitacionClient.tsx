'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS } from '@/components/icons';
import type { CapacitacionTipo } from '@/lib/types';

export interface Curso {
  empresaId: string;
  empresa: string;
  titulo: string;
  modo: CapacitacionTipo;
  completada: boolean;
}

export function CapacitacionClient({
  cursos,
  freelancerId,
}: {
  cursos: Curso[];
  freelancerId: string;
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(
    Object.fromEntries(cursos.map((c) => [c.empresaId, c.completada])),
  );
  const [ocupado, setOcupado] = useState<string | null>(null);

  const completar = async (empresaId: string) => {
    setOcupado(empresaId);
    const { error } = await supabaseBrowser()
      .from('suscripciones')
      .update({ capacitacion_completada: true })
      .eq('freelancer_id', freelancerId)
      .eq('empresa_id', empresaId);
    if (!error) setEstado((s) => ({ ...s, [empresaId]: true }));
    setOcupado(null);
  };

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[26px] font-extrabold tracking-tight">Capacitación</h1>
      <p className="mt-0.5 text-sm text-slate2">Cursos de tus empresas suscritas.</p>

      <div className="mt-5 flex flex-col gap-3.5">
        {cursos.map((c) => {
          const completo = estado[c.empresaId];
          const presencial = c.modo === 'presencial';
          return (
            <div
              key={c.empresaId}
              className="rounded-[18px] border border-line bg-white p-5 transition-shadow hover:shadow-[0_6px_18px_rgba(10,10,15,.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate3">{c.empresa}</div>
                  <div className="mt-0.5 text-base font-bold">{c.titulo}</div>
                </div>
                <div
                  className="rounded-full px-[11px] py-1 text-[11px] font-semibold"
                  style={
                    presencial
                      ? { background: 'rgba(245,158,11,.12)', color: '#F59E0B' }
                      : { background: 'rgba(14,165,233,.1)', color: '#0EA5E9' }
                  }
                >
                  {presencial ? 'Presencial' : 'En línea'}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg,#00D4FF,#8B5CF6)',
                      width: completo ? '100%' : '0%',
                      transition: 'width .9s cubic-bezier(.2,.8,.2,1)',
                    }}
                  />
                </div>
                <div className="text-[13px] font-bold text-slate2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {completo ? '100%' : '0%'}
                </div>
              </div>

              {completo ? (
                <div className="mt-3.5 flex items-center gap-3 rounded-[14px] bg-badge px-4 py-3.5 text-white">
                  <Icon d={ICON_PATHS.medal} size={24} stroke="#fff" strokeWidth={2} />
                  <div className="flex-1">
                    <div className="text-sm font-bold">Certificado obtenido</div>
                    <div className="text-xs opacity-85">Vendedor certificado · {c.empresa}</div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => completar(c.empresaId)}
                  disabled={ocupado === c.empresaId}
                  className="mt-3.5 text-[13px] font-semibold text-[#0EA5E9] transition-colors hover:text-violet1 disabled:opacity-60"
                >
                  {presencial
                    ? 'Marcar capacitación presencial como completada →'
                    : 'Marcar curso como completado →'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {cursos.length === 0 && (
        <div className="mt-5 rounded-[20px] border border-dashed border-line bg-surface p-10 text-center">
          <div className="text-3xl">📚</div>
          <div className="mt-2 text-sm font-semibold">Sin cursos por ahora</div>
          <div className="mt-1 text-[13px] text-slate2">
            Suscríbete a una empresa con capacitación para verla aquí.
          </div>
          <Link
            href="/app/empresas"
            className="btn-gradient mt-4 inline-block px-[22px] py-[11px] text-sm"
          >
            Ver empresas
          </Link>
        </div>
      )}
    </div>
  );
}
