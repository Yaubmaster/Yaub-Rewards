'use client';

// "Ver oferta completa": todo lo que el vendedor necesita para decidir si la
// vende — fotos, descripción entera, precio, comisión, cuándo se libera, quién
// la publica — y el botón para guardarla en "Mis ofertas".
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Icon, ICON_PATHS } from '@/components/icons';
import { mxn } from '@/lib/format';
import { CAPACITACION_TXT, type OfertaPublicada } from '@/lib/ofertas';

/** Foquito por canal encendido del agente. */
export function Canales({ canales, activo }: { canales: string[]; activo: boolean }) {
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

/** Corazón de "guardar en mis ofertas". */
export function BotonFavorita({
  favorita,
  suscrito,
  ocupado,
  onClick,
  compacto = false,
}: {
  favorita: boolean;
  suscrito: boolean;
  ocupado?: boolean;
  onClick: () => void;
  compacto?: boolean;
}) {
  const bloqueado = !suscrito && !favorita;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!bloqueado && !ocupado) onClick();
      }}
      disabled={ocupado}
      title={bloqueado ? 'Suscríbete a este agente para guardar su oferta' : undefined}
      aria-pressed={favorita}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-60 ${
        favorita
          ? 'border-[rgba(236,72,153,.4)] bg-[rgba(236,72,153,.09)] text-[#DB2777]'
          : bloqueado
            ? 'cursor-not-allowed border-line text-slate3 opacity-60'
            : 'border-line text-slate2 hover:border-[rgba(236,72,153,.5)] hover:text-[#DB2777]'
      }`}
    >
      <Icon
        d={ICON_PATHS.heart}
        size={14}
        stroke={favorita ? '#DB2777' : 'currentColor'}
        strokeWidth={2}
        className={favorita ? 'fill-[#DB2777]' : undefined}
      />
      {!compacto && (favorita ? 'Guardada' : 'Guardar')}
    </button>
  );
}

export function OfertaDetalle({
  oferta,
  onCerrar,
  onFavorita,
  onSuscribir,
  ocupado,
}: {
  oferta: OfertaPublicada;
  onCerrar: () => void;
  onFavorita: () => void;
  onSuscribir?: () => void;
  ocupado?: boolean;
}) {
  const [foto, setFoto] = useState(0);
  const fotos = oferta.fotos ?? [];

  // Escape cierra y el fondo no hace scroll mientras está abierta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,.55)] p-0 backdrop-blur-[2px] md:items-center md:p-6"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={oferta.producto}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fadeUpFast flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] bg-card md:rounded-[24px]"
      >
        {/* Cabecera fija */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 md:px-5">
          <Avatar url={oferta.agente_avatar} nombre={oferta.empresa} size={38} icono="bot" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold">{oferta.empresa}</div>
            <div className="truncate text-[11.5px] text-slate3">
              Publicado por {oferta.publicado_por}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-slate2 transition-colors hover:border-cyan1"
            aria-label="Cerrar"
          >
            <Icon d={ICON_PATHS.close} size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {fotos.length > 0 && (
            <div className="bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotos[Math.min(foto, fotos.length - 1)]}
                alt={oferta.producto}
                className="h-[220px] w-full object-cover md:h-[260px]"
              />
              {fotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-2.5">
                  {fotos.map((f, i) => (
                    <button
                      key={f + i}
                      onClick={() => setFoto(i)}
                      className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                        i === foto ? 'border-cyan1' : 'border-transparent opacity-70'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-4 md:px-5">
            <h2 className="text-[19px] font-extrabold leading-snug tracking-tight">
              {oferta.producto}
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-line bg-surface p-3.5">
                <div className="text-[11px] font-semibold tracking-[0.06em] text-slate3">
                  TU COMISIÓN
                </div>
                <div className="text-gradient mt-0.5 text-[24px] font-extrabold tracking-tight">
                  {mxn(oferta.comision_mxn)}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-3.5">
                <div className="text-[11px] font-semibold tracking-[0.06em] text-slate3">
                  PRECIO AL CLIENTE
                </div>
                <div className="mt-0.5 text-[24px] font-extrabold tracking-tight">
                  {oferta.precio_mxn ? mxn(oferta.precio_mxn) : '—'}
                </div>
              </div>
            </div>

            {oferta.descripcion && (
              <p className="mt-3.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate2">
                {oferta.descripcion}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5 text-[13px]">
                <Icon d={ICON_PATHS.clock} size={16} stroke="rgb(var(--tinta3))" className="mt-px shrink-0" />
                <span className="text-slate2">
                  <b className="font-bold">Se libera:</b>{' '}
                  {oferta.condicion ?? 'al confirmarse la venta'}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-[13px]">
                <Icon d={ICON_PATHS.cap} size={16} stroke="rgb(var(--tinta3))" className="mt-px shrink-0" />
                <span className="text-slate2">
                  {CAPACITACION_TXT[oferta.capacitacion] ?? oferta.capacitacion}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-[13px]">
                <Icon d={ICON_PATHS.bot} size={16} stroke="rgb(var(--tinta3))" className="mt-px shrink-0" />
                <div className="min-w-0 text-slate2">
                  Vende <b className="font-bold">{oferta.agente ?? oferta.empresa}</b>, el agente de IA.
                  <div className="mt-1.5">
                    <Canales canales={oferta.canales} activo={oferta.agente_activo} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-3.5">
              <div className="text-[12.5px] font-bold">Cómo cobras esta comisión</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate2">
                Cuando el agente le pregunte al cliente quién lo recomendó, el cliente le da tu
                código. El agente lo registra solo y libera tu comisión al cumplirse la condición.
                Tú no tienes que hacer nada más.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones fijas abajo */}
        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3 md:px-5">
          {!oferta.suscrito && onSuscribir ? (
            <button
              onClick={onSuscribir}
              disabled={ocupado}
              className="btn-gradient flex-1 py-3 text-sm disabled:opacity-60"
            >
              {ocupado ? '…' : 'Suscribirme para vender esto'}
            </button>
          ) : (
            <button
              onClick={onFavorita}
              disabled={ocupado}
              className={
                oferta.favorita
                  ? 'flex-1 rounded-xl border border-line py-3 text-sm font-bold text-slate2 disabled:opacity-60'
                  : 'btn-gradient flex-1 py-3 text-sm disabled:opacity-60'
              }
            >
              {ocupado ? '…' : oferta.favorita ? 'Quitar de mis ofertas' : 'Agregar a mis ofertas'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
