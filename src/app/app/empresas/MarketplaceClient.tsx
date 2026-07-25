'use client';

// Marketplace del vendedor en tres niveles:
//   cuenta (tenant) → agentes/empresas de esa cuenta → ofertas del agente
// Suscribirse a una empresa es suscribirse a su agente.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar } from '@/components/Avatar';
import { BotonFavorita, Canales, OfertaDetalle } from '@/components/OfertaDetalle';
import { Icon, ICON_PATHS } from '@/components/icons';
import { mxn } from '@/lib/format';
import { alternarFavorita, cargarOfertas, type OfertaPublicada } from '@/lib/ofertas';

const VISTOS_KEY = 'rewards_agentes_vistos';

const leerVistos = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(VISTOS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

export function MarketplaceClient({ freelancerId }: { freelancerId: string }) {
  const [ofertas, setOfertas] = useState<OfertaPublicada[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [tenantAbierto, setTenantAbierto] = useState<string | null>(null);
  const [empresaAbierta, setEmpresaAbierta] = useState<string | null>(null);
  const [vistos, setVistos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setOfertas(await cargarOfertas());
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

  const favorita = async (o: OfertaPublicada) => {
    setOcupado(o.oferta_id);
    setError(null);
    try {
      await alternarFavorita(freelancerId, o.oferta_id, o.favorita);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
      setTimeout(() => setError(null), 3200);
    } finally {
      setOcupado(null);
    }
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
    const mapa = new Map<
      string,
      { nombre: string; avatar: string | null; empresas: Map<string, OfertaPublicada[]> }
    >();
    for (const o of filtradas) {
      const tk = o.tenant_id ?? o.publicado_por;
      if (!mapa.has(tk))
        mapa.set(tk, { nombre: o.publicado_por, avatar: o.tenant_avatar, empresas: new Map() });
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

  const detalle = useMemo(
    () => (ofertas ?? []).find((o) => o.oferta_id === abierta) ?? null,
    [ofertas, abierta],
  );

  const guardadas = (ofertas ?? []).filter((o) => o.favorita).length;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Empresas</h1>
          <p className="mt-0.5 text-[13px] text-slate2">
            Cada empresa es un agente de IA. Suscríbete y refiérele clientes con tu código.
          </p>
        </div>
        {guardadas > 0 && (
          <Link
            href="/app/mis-ofertas"
            className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-bold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
          >
            <Icon d={ICON_PATHS.heart} size={14} strokeWidth={2} />
            Mis ofertas ({guardadas})
          </Link>
        )}
      </div>

      <input
        className="input-yaub mt-4"
        placeholder="Busca por agente, empresa, cuenta o producto…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {error && (
        <div className="mt-3 rounded-2xl border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3 text-[13px] font-semibold text-[#B45309]">
          {error}
        </div>
      )}

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
                className="card flex shrink-0 items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:border-cyan1"
              >
                <Avatar url={o.agente_avatar} nombre={o.empresa} size={30} icono="bot" />
                <div>
                  <div className="text-[13px] font-bold">{o.empresa}</div>
                  <div className="text-[11px] text-slate3">{o.publicado_por}</div>
                </div>
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
                <Avatar url={t.avatar} nombre={t.nombre} size={40} />
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
                          <Avatar url={cab.agente_avatar} nombre={cab.empresa} size={36} icono="bot" />
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
                                  <div className="flex items-start gap-3">
                                    {o.fotos?.[0] && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={o.fotos[0]}
                                        alt=""
                                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[13.5px] font-bold">{o.producto}</div>
                                      {o.descripcion && (
                                        <div className="mt-0.5 line-clamp-2 text-[12.5px] text-slate2">
                                          {o.descripcion}
                                        </div>
                                      )}
                                    </div>
                                    <BotonFavorita
                                      favorita={o.favorita}
                                      suscrito={o.suscrito}
                                      ocupado={ocupado === o.oferta_id}
                                      onClick={() => favorita(o)}
                                      compacto
                                    />
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[12px]">
                                    <span className="text-slate3">
                                      Tu comisión{' '}
                                      <b className="text-gradient text-[13px]">
                                        {mxn(o.comision_mxn)}
                                      </b>
                                    </span>
                                    <button
                                      onClick={() => setAbierta(o.oferta_id)}
                                      className="font-bold text-[#0EA5E9] transition-colors hover:text-violet1"
                                    >
                                      Ver oferta completa →
                                    </button>
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

      {detalle && (
        <OfertaDetalle
          oferta={detalle}
          ocupado={ocupado === detalle.oferta_id || ocupado === detalle.empresa_id}
          onCerrar={() => setAbierta(null)}
          onFavorita={() => favorita(detalle)}
          onSuscribir={() => alternar(detalle.empresa_id, false)}
        />
      )}
    </div>
  );
}
