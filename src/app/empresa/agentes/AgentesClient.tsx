'use client';

// Sección "Agentes Yaub Conectados" del perfil de empresa: lista los agentes
// del tenant (leyendo de public.assistants vía la edge function) con su
// estatus de trial, y el CTA "Crear agente gratis".
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, ICON_PATHS } from '@/components/icons';
import {
  agentesApi,
  diasRestantes,
  estadoAgente,
  type AgenteResumen,
} from '@/lib/agentesApi';

function ChipEstado({ agente }: { agente: AgenteResumen }) {
  const estado = estadoAgente(agente);
  const dias = diasRestantes(agente.trial);
  const map = {
    activo: { txt: 'Activo', bg: 'rgba(16,185,129,.12)', fg: '#059669' },
    prueba: {
      txt: dias === 1 ? 'Te queda 1 día de prueba' : `Te quedan ${dias} días de prueba`,
      bg: 'rgba(0,212,255,.12)',
      fg: '#0284C7',
    },
    pausado: { txt: 'Pausado', bg: 'rgba(245,158,11,.14)', fg: '#B45309' },
  }[estado];
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.txt}
    </span>
  );
}

export function AgentesClient({ empresaId }: { empresaId: string }) {
  const [agentes, setAgentes] = useState<AgenteResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    agentesApi<{ agentes: AgenteResumen[] }>({ action: 'list', empresa_id: empresaId })
      .then((out) => setAgentes(out.agentes))
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Agentes Yaub Conectados</h1>
          <p className="mt-0.5 text-[13px] text-slate2">
            Los agentes de tu negocio conectados a Rewards — la misma cuenta funciona en
            platform.yaub.ai
          </p>
        </div>
        <Link
          href="/empresa/agentes/nuevo"
          className="btn-gradient flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Icon d={ICON_PATHS.plus} size={16} stroke="#fff" strokeWidth={2.4} />
          Crear agente gratis
        </Link>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
          {error}
        </div>
      )}

      {!agentes && !error && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="shimmer h-[86px] rounded-[20px]" />
          <div className="shimmer h-[86px] rounded-[20px]" />
        </div>
      )}

      {agentes && agentes.length === 0 && (
        <div className="card mt-5 flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-badge">
            <Icon d={ICON_PATHS.bot} size={28} stroke="#fff" strokeWidth={2} />
          </div>
          <div className="mt-4 text-lg font-bold">Tu primer agente, gratis 7 días</div>
          <p className="mt-1 max-w-[380px] text-sm text-slate2">
            Solo necesitas un nombre y decirle qué hace tu negocio. En menos de 2 minutos ya
            puedes chatear con él.
          </p>
          <Link href="/empresa/agentes/nuevo" className="btn-gradient mt-5 px-5 py-3 text-sm">
            Crear agente gratis
          </Link>
        </div>
      )}

      {agentes && agentes.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {agentes.map((a) => (
            <Link
              key={a.id}
              href={`/empresa/agentes/${a.id}`}
              className="card flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan1 md:p-5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-badge">
                {a.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                ) : (
                  <Icon d={ICON_PATHS.bot} size={22} stroke="#fff" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{a.name}</div>
                <div className="mt-0.5 text-xs text-slate3">
                  {a.source === 'yaub_native' ? 'Chat web' : a.source}
                </div>
              </div>
              <ChipEstado agente={a} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
