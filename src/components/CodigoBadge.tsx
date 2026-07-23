'use client';

import { useState } from 'react';

export function useCopiar(texto: string) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* clipboard no disponible */
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };
  return { copiado, copiar };
}

export function mensajeWhatsApp(codigo: string) {
  const texto = `¡Cámbiate a Yaub Móvil y conserva tu número! 📱 Cuando hables con el agente, di que te recomendé yo con mi código *${codigo}* y te ayudan con todo el trámite.`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// Pill compacto de código con botón copiar (header de Inicio / Perfil)
export function CodigoPill({ codigo }: { codigo: string }) {
  const { copiado, copiar } = useCopiar(codigo);
  return (
    <button
      onClick={copiar}
      className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-[9px] transition-colors hover:border-cyan1"
    >
      <span className="text-gradient text-sm font-extrabold tracking-wide">{codigo}</span>
      <span className="text-xs font-semibold text-slate3">{copiado ? '✓ Copiado' : 'Copiar'}</span>
    </button>
  );
}
