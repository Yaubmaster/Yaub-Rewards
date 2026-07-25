'use client';

// "Mis ofertas": las que el vendedor guardó, mezcladas de todos los agentes a
// los que está suscrito, con su foto y su resumen. Es su lista de trabajo: lo
// que decidió vender, sin tener que volver a entrar cuenta por cuenta.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Canales, OfertaDetalle } from '@/components/OfertaDetalle';
import { Icon, ICON_PATHS } from '@/components/icons';
import { mxn } from '@/lib/format';
import { alternarFavorita, cargarOfertas, type OfertaPublicada } from '@/lib/ofertas';

export function MisOfertasClient({ freelancerId }: { freelancerId: string }) {
  const [todas, setTodas] = useState<OfertaPublicada[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setTodas(await cargarOfertas());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const quitar = async (o: OfertaPublicada) => {
    setOcupado(o.oferta_id);
    try {
      await alternarFavorita(freelancerId, o.oferta_id, o.favorita);
      await cargar();
      setAbierta(null);
    } finally {
      setOcupado(null);
    }
  };

  const favoritas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (todas ?? [])
      .filter((o) => o.favorita)
      .filter(
        (o) =>
          !q ||
          [o.producto, o.empresa, o.agente, o.publicado_por, o.descripcion]
            .filter(Boolean)
            .some((c) => (c as string).toLowerCase().includes(q)),
      );
  }, [todas, busqueda]);

  const totalPotencial = useMemo(
    () => favoritas.reduce((s, o) => s + Number(o.comision_mxn), 0),
    [favoritas],
  );

  const detalle = useMemo(
    () => (todas ?? []).find((o) => o.oferta_id === abierta) ?? null,
    [todas, abierta],
  );

  if (!todas) {
    return (
      <div className="flex flex-col gap-3">
        <div className="shimmer h-8 w-2/5 rounded-lg" />
        <div className="shimmer h-32 rounded-[20px]" />
        <div className="shimmer h-32 rounded-[20px]" />
      </div>
    );
  }

  const guardadas = todas.filter((o) => o.favorita).length;

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[22px] font-extrabold tracking-tight">Mis ofertas</h1>
      <p className="mt-0.5 text-[13px] text-slate2">
        Lo que guardaste de todos tus agentes, junto. Da tu código al cerrar y el agente registra la
        comisión solo.
      </p>

      {guardadas === 0 ? (
        <div className="card mt-5 flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-badge">
            <Icon d={ICON_PATHS.heart} size={26} stroke="#fff" strokeWidth={2} />
          </div>
          <div className="mt-4 text-lg font-bold">Todavía no guardas ninguna oferta</div>
          <p className="mt-1 max-w-[380px] text-sm text-slate2">
            Entra a Empresas, abre una oferta completa y dale “Agregar a mis ofertas”. Aquí las verás
            todas juntas.
          </p>
          <Link href="/app/empresas" className="btn-gradient mt-5 px-5 py-3 text-sm">
            Ver empresas
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-[18px] border border-line bg-white p-4">
            <div className="text-xs font-semibold tracking-[0.08em] text-slate3">
              SI CIERRAS UNA DE CADA UNA
            </div>
            <div
              className="text-gradient mt-1 text-[30px] font-extrabold tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {mxn(totalPotencial)}
            </div>
            <div className="text-[12.5px] text-slate3">
              {guardadas === 1 ? '1 oferta guardada' : `${guardadas} ofertas guardadas`}
            </div>
          </div>

          {guardadas > 4 && (
            <input
              className="input-yaub mt-3.5"
              placeholder="Busca entre tus ofertas…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          )}

          {favoritas.length === 0 && (
            <div className="card mt-4 px-5 py-8 text-center text-sm text-slate2">
              No encontramos nada con “{busqueda}”.
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {favoritas.map((o) => (
              <button
                key={o.oferta_id}
                onClick={() => setAbierta(o.oferta_id)}
                className="card overflow-hidden p-0 text-left transition-all hover:-translate-y-0.5 hover:border-cyan1"
              >
                {o.fotos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.fotos[0]} alt="" className="h-32 w-full object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar url={o.agente_avatar} nombre={o.empresa} size={28} icono="bot" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold">{o.empresa}</div>
                      <div className="truncate text-[11px] text-slate3">{o.publicado_por}</div>
                    </div>
                    <Icon
                      d={ICON_PATHS.heart}
                      size={15}
                      stroke="#DB2777"
                      strokeWidth={2}
                      className="shrink-0 fill-[#DB2777]"
                    />
                  </div>

                  <div className="mt-2.5 text-[14.5px] font-bold leading-snug">{o.producto}</div>
                  {o.descripcion && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-slate2">
                      {o.descripcion}
                    </p>
                  )}

                  <div className="mt-2.5">
                    <Canales canales={o.canales} activo={o.agente_activo} />
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
                    <div>
                      <div className="text-[10.5px] font-semibold tracking-[0.06em] text-slate3">
                        TU COMISIÓN
                      </div>
                      <div className="text-gradient text-[19px] font-extrabold tracking-tight">
                        {mxn(o.comision_mxn)}
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-[#0EA5E9]">Ver completa →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {detalle && (
        <OfertaDetalle
          oferta={detalle}
          ocupado={ocupado === detalle.oferta_id}
          onCerrar={() => setAbierta(null)}
          onFavorita={() => quitar(detalle)}
        />
      )}
    </div>
  );
}
