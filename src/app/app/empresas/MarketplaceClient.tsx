'use client';

// Marketplace del vendedor en tres niveles:
//   cuenta (tenant) → agentes/empresas de esa cuenta → ofertas del agente
// Suscribirse a una empresa es suscribirse a su agente.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS } from '@/components/icons';
import { mxn } from '@/lib/format';

export interface OfertaPublicada {
  oferta_id: string;
  producto: string;
  descripcion: string | null;
  comision_mxn: number;
  precio_mxn: number | null;
  condicion: string | null;
  capacitacion: string;
  fotos: string[];
  empresa_id: string;
  empresa: string;
  assistant_id: string | null;
  agente: string | null;
  canales: string[];
  agente_activo: boolean;
  tenant_id: string | null;
  publicado_por: string;
  suscrito: boolean;
}

const VISTOS_KEY = 'rewards_agentes_vistos';

const leerVistos = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(VISTOS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Foquito por canal encendido del agente. */
function Canales({ canales, activo }: { canales: string[]; activo: boolean }) {
  const mapa: Record<string, { txt: string; color: string }> = {
    whatsapp: { txt: 'WhatsApp', color: '#25D366' },
    web: { txt: 'Chat web', color: '#00D4FF' },
    voice: { txt: 'Voz', color: '#8B5CF6' },
    voz: { txt: 'Voz', color: '#8B5CF6' },
    telegram: { txt: 'Telegram', color: '#0EA5E9' },
  };
  const unicos = Array.from(new Set(canales ?? [])).filter((c) => mapa[c]);
  if (unicos.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {unicos.map((c) => (
        <span
          key={c}
          className="flex items-center gap-1.5 rounded-full border border-line px-2 py-[3px] text-[10.5px] font-bold text-slate2"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${activo ? 'animate-pulseDot' : ''}`}
            style={{ background: activo ? mapa[c].color : '#94A3B8' }}
          />
          {mapa[c].txt}
        </span>
      ))}
    </div>
  );
}

export function MarketplaceClient({ freelancerId }: { freelancerId: string }) {
  const [ofertas, setOfertas] = useState<OfertaPublicada[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [tenantAbierto, setTenantAbierto] = useState<string | null>(null);
  const [empresaAbierta, setEmpresaAbierta] = useState<string | null>(null);
  const [vistos, setVistos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.rpc('ofertas_publicadas');
    setOfertas((data ?? []) as unknown as OfertaPublicada[]);
  }, []);

  useEffect(() => {
    cargar();
    setVistos(leerVistos());
  }, [cargar]);

  const abrirEmpresa = (empresaId: string) => {
    setEmpresaAbierta((prev) => (prev === empresaId ? null : empresaId));
    const prev = leerVistos().filter((x) => x !== empresaId);
    localStorage.setItem(VISTOS_KEY, JSON.stringify([empresaId, ...prev].slice(0, 12)));
    setVistos(leerVistos());
  };

  const alternar = async (empresaId: string, suscrito: boolean) => {
    setOcupado(empresaId);
    const supabase = supabaseBrowser();
    if (suscrito) {
      await supabase
        .from('suscripciones')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('freelancer_id', freelancerId);
    } else {
      await supabase
        .from('suscripciones')
        .upsert({ empresa_id: empresaId, freelancer_id: freelancerId });
    }
    setOcupado(null);
    await cargar();
  };

  // Busca por agente, empresa, cuenta o producto
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ofertas ?? [];
    return (ofertas ?? []).filter((o) =>
      [o.producto, o.empresa, o.agente, o.publicado_por, o.descripcion]
        .filter(Boolean)
        .some((c) => (c as string).toLowerCase().includes(q)),
    );
  }, [ofertas, busqueda]);

  const porTenant = useMemo(() => {
    const mapa = new Map<string, { nombre: string; empresas: Map<string, OfertaPublicada[]> }>();
    for (const o of filtradas) {
      const tk = o.tenant_id ?? o.publicado_por;
      if (!mapa.has(tk)) mapa.set(tk, { nombre: o.publicado_por, empresas: new Map() });
      const t = mapa.get(tk)!;
      if (!t.empresas.has(o.empresa_id)) t.empresas.set(o.empresa_id, []);
      t.empresas.get(o.empresa_id)!.push(o);
    }
    return Array.from(mapa.entries());
  }, [filtradas]);

  const recientes = useMemo(() => {
    const cab = new Map<string, OfertaPublicada>();
    for (const o of ofertas ?? []) if (!cab.has(o.empresa_id)) cab.set(o.empresa_id, o);
    return vistos.map((id) => cab.get(id)).filter(Boolean).slice(0, 3) as OfertaPublicada[];
  }, [vistos, ofertas]);

  if (!ofertas) {
    return (
      <div className="flex flex-col gap-3">
        <div className="shimmer h-11 rounded-2xl" />
        <div className="shimmer h-24 rounded-[20px]" />
        <div className="shimmer h-24 rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[22px] font-extrabold tracking-tight">Empresas</h1>
      <p className="mt-0.5 text-[13px] text-slate2">
        Cada empresa es un agente de IA. Suscríbete y refiérele clientes con tu código.
      </p>

      <input
        className="input-yaub mt-4"
        placeholder="Busca por agente, empresa, cuenta o producto…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {recientes.length > 0 && !busqueda && (
        <>
          <div className="mt-5 text-[12.5px] font-bold text-slate3">VISTOS RECIENTEMENTE</div>
          <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1">
            {recientes.map((o) => (
              <button
                key={o.empresa_id}
                onClick={() => {
                  setTenantAbierto(o.tenant_id ?? o.publicado_por);
                  abrirEmpresa(o.empresa_id);
                }}
                className="card shrink-0 px-3.5 py-2.5 text-left transition-colors hover:border-cyan1"
              >
                <div className="text-[13px] font-bold">{o.empresa}</div>
                <div className="text-[11px] text-slate3">{o.publicado_por}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {porTenant.length === 0 && (
        <div className="card mt-5 px-5 py-8 text-center text-sm text-slate2">
          {busqueda ? `No encontramos nada con “${busqueda}”.` : 'Todavía no hay ofertas publicadas.'}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {porTenant.map(([tk, t]) => {
          const abierto = tenantAbierto === tk || !!busqueda;
          const n = t.empresas.size;
          return (
            <div key={tk} className="card overflow-hidden p-0">
              <button
                onClick={() => setTenantAbierto(abierto && !busqueda ? null : tk)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-badge text-[15px] font-extrabold text-white">
                  {t.nombre.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{t.nombre}</div>
                  <div className="text-xs text-slate3">{n === 1 ? '1 agente' : `${n} agentes`}</div>
                </div>
                <span className={`text-slate3 transition-transform ${abierto ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>

              {abierto && (
                <div className="border-t border-line bg-surface/50 p-3">
                  {Array.from(t.empresas.entries()).map(([empresaId, lista]) => {
                    const cab = lista[0];
                    const desplegada = empresaAbierta === empresaId || !!busqueda;
                    return (
                      <div
                        key={empresaId}
                        className="mb-2 rounded-2xl border border-line bg-white last:mb-0"
                      >
                        <button
                          onClick={() => abrirEmpresa(empresaId)}
                          className="flex w-full items-center gap-3 p-3.5 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge">
                            <Icon d={ICON_PATHS.bot} size={17} stroke="#fff" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold">{cab.empresa}</div>
                            <div className="mt-1">
                              <Canales canales={cab.canales} activo={cab.agente_activo} />
                            </div>
                          </div>
                          {cab.suscrito && (
                            <span className="shrink-0 rounded-full bg-[rgba(16,185,129,.12)] px-2.5 py-1 text-[10.5px] font-bold text-green1">
                              ✓ Suscrito
                            </span>
                          )}
                        </button>

                        {desplegada && (
                          <div className="border-t border-line p-3.5">
                            <div className="mb-2 text-[11.5px] font-bold text-slate3">
                              {lista.length === 1 ? '1 OFERTA' : `${lista.length} OFERTAS`}
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {lista.map((o) => (
                                <div key={o.oferta_id} className="rounded-xl bg-surface p-3">
                                  <div className="text-[13.5px] font-bold">{o.producto}</div>
                                  {o.descripcion && (
                                    <div className="mt-0.5 text-[12.5px] text-slate2">
                                      {o.descripcion}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                                    <span className="text-slate3">
                                      Tu comisión{' '}
                                      <b className="text-gradient text-[13px]">
                                        {mxn(o.comision_mxn)}
                                      </b>
                                    </span>
                                    {o.condicion && (
                                      <span className="text-slate3">Se libera: {o.condicion}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <span className="text-[11.5px] text-slate3">
                                Publicado por <b className="text-slate2">{cab.publicado_por}</b>
                              </span>
                              <button
                                onClick={() => alternar(empresaId, cab.suscrito)}
                                disabled={ocupado === empresaId}
                                className={
                                  cab.suscrito
                                    ? 'rounded-xl border border-line px-4 py-2 text-[12.5px] font-bold text-slate2'
                                    : 'btn-gradient px-4 py-2 text-[12.5px]'
                                }
                              >
                                {ocupado === empresaId
                                  ? '…'
                                  : cab.suscrito
                                    ? 'Quitar suscripción'
                                    : 'Suscribirme'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
