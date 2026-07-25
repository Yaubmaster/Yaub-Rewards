'use client';

// Sección "Agentes Yaub Conectados": cada empresa del usuario es un agente.
// Muestra todas sus empresas (aunque no sean la activa) con el estado de su
// agente y las interacciones gratis que le quedan.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, ICON_PATHS } from '@/components/icons';
import {
  estadoAgente,
  interaccionesRestantes,
  misEmpresasAgentes,
  type EmpresaConAgente,
} from '@/lib/agentesApi';

function Estado({ item }: { item: EmpresaConAgente }) {
  const estado = estadoAgente(item.agente);
  const restantes = interaccionesRestantes(item.agente);
  const map = {
    sin_agente: { txt: 'Sin agente', bg: 'rgba(148,163,184,.16)', fg: '#64748B' },
    activo: { txt: 'Con plan activo', bg: 'rgba(16,185,129,.12)', fg: '#059669' },
    prueba: {
      txt: `${restantes} interacciones gratis`,
      bg: 'rgba(0,212,255,.12)',
      fg: '#0284C7',
    },
    agotado: { txt: 'Prueba agotada', bg: 'rgba(245,158,11,.14)', fg: '#B45309' },
  }[estado];
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.txt}
    </span>
  );
}

function Barra({ item }: { item: EmpresaConAgente }) {
  if (!item.agente || item.agente.activado) return null;
  const { interacciones_usadas: usadas, interacciones_incluidas: total } = item.agente;
  const pct = Math.min(100, (usadas / Math.max(1, total)) * 100);
  return (
    <div className="mt-2.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(3, pct)}%`,
            background: pct >= 100 ? '#F59E0B' : 'linear-gradient(90deg,#00D4FF,#8B5CF6)',
          }}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate3">
        {usadas} de {total} interacciones de prueba usadas
      </div>
    </div>
  );
}

export function AgentesClient() {
  const [items, setItems] = useState<EmpresaConAgente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    misEmpresasAgentes()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="animate-fadeUpFast">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Agentes Yaub Conectados</h1>
        <p className="mt-0.5 text-[13px] text-slate2">
          Cada empresa tuya es un agente. Empiezas con 100 interacciones gratis y luego eliges
          plan — la misma cuenta funciona en platform.yaub.ai
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="shimmer h-[96px] rounded-[20px]" />
          <div className="shimmer h-[96px] rounded-[20px]" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card mt-5 flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-badge">
            <Icon d={ICON_PATHS.store} size={28} stroke="#fff" strokeWidth={2} />
          </div>
          <div className="mt-4 text-lg font-bold">Aún no tienes empresas</div>
          <p className="mt-1 max-w-[380px] text-sm text-slate2">
            Registra tu negocio y le creamos su agente con sus productos y comisiones.
          </p>
          <Link href="/registro/empresa?nueva=1" className="btn-gradient mt-5 px-5 py-3 text-sm">
            Registrar empresa
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {items.map((it) => {
            const cuerpo = (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-badge">
                    <Icon
                      d={it.agente ? ICON_PATHS.bot : ICON_PATHS.store}
                      size={22}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{it.empresa}</div>
                    <div className="mt-0.5 text-xs text-slate3">
                      {it.agente ? it.agente.nombre : 'Todavía sin agente'} ·{' '}
                      {it.ofertas === 1 ? '1 oferta' : `${it.ofertas} ofertas`}
                    </div>
                  </div>
                  <Estado item={it} />
                </div>
                <Barra item={it} />
              </>
            );

            return it.agente ? (
              <Link
                key={it.empresa_id}
                href={`/empresa/agentes/${it.agente.id}`}
                className="card p-4 transition-all hover:-translate-y-0.5 hover:border-cyan1 md:p-5"
              >
                {cuerpo}
              </Link>
            ) : (
              <div key={it.empresa_id} className="card p-4 md:p-5">
                {cuerpo}
                <Link
                  href={`/empresa/agentes/nuevo?empresa=${it.empresa_id}`}
                  className="btn-gradient mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-[13px]"
                >
                  <Icon d={ICON_PATHS.plus} size={15} stroke="#fff" strokeWidth={2.4} />
                  Crear su agente gratis
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
