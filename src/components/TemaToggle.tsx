'use client';

// Switch de tema claro/oscuro de la plataforma. El tema vive en
// document.documentElement.dataset.tema y se persiste en localStorage; el
// script de layout.tsx lo aplica antes del primer pintado.
import { useEffect, useState } from 'react';
import { Icon, ICON_PATHS } from '@/components/icons';

export type Tema = 'light' | 'dark';

function leerTema(): Tema {
  return document.documentElement.dataset.tema === 'dark' ? 'dark' : 'light';
}

export function useTema() {
  // Arranca en 'light' y se sincroniza al montar: el HTML del servidor no
  // conoce la preferencia del cliente.
  const [tema, setTema] = useState<Tema>('light');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setTema(leerTema());
    setListo(true);
  }, []);

  const alternar = () => {
    const nuevo: Tema = leerTema() === 'dark' ? 'light' : 'dark';
    if (nuevo === 'dark') document.documentElement.dataset.tema = 'dark';
    else delete document.documentElement.dataset.tema;
    try {
      localStorage.setItem('rewards_tema', nuevo);
    } catch {
      /* modo privado: el tema dura la sesión */
    }
    setTema(nuevo);
  };

  return { tema, listo, alternar };
}

/** Switch tipo pill. `variante="fila"` lo muestra con etiqueta (sidebar/perfil). */
export function TemaToggle({ variante = 'icono' }: { variante?: 'icono' | 'fila' }) {
  const { tema, listo, alternar } = useTema();
  const oscuro = tema === 'dark';
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  const pill = (
    <span
      aria-hidden="true"
      className="relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-line transition-colors"
      style={{ background: oscuro ? '#8B5CF6' : 'rgb(var(--superficie))' }}
    >
      <span
        className="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white transition-transform"
        style={{
          transform: oscuro ? 'translateX(23px)' : 'translateX(2px)',
          boxShadow: '0 1px 3px rgba(10,10,15,.25)',
        }}
      >
        <Icon
          d={oscuro ? ICON_PATHS.moon : ICON_PATHS.sun}
          size={12}
          strokeWidth={2.2}
          stroke={oscuro ? '#8B5CF6' : '#F59E0B'}
        />
      </span>
    </span>
  );

  if (variante === 'fila') {
    return (
      <button
        onClick={alternar}
        aria-label={etiqueta}
        aria-pressed={oscuro}
        suppressHydrationWarning
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-[11px] transition-colors hover:bg-surface"
      >
        <Icon
          d={oscuro ? ICON_PATHS.moon : ICON_PATHS.sun}
          size={18}
          stroke={oscuro ? '#8B5CF6' : '#94A3B8'}
        />
        <span className="text-[13px] font-semibold text-slate2" suppressHydrationWarning>
          {listo && oscuro ? 'Modo oscuro' : 'Modo claro'}
        </span>
        <span className="ml-auto">{pill}</span>
      </button>
    );
  }

  return (
    <button
      onClick={alternar}
      aria-label={etiqueta}
      aria-pressed={oscuro}
      suppressHydrationWarning
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] border border-line bg-white transition-colors hover:border-violet1"
    >
      <Icon
        d={oscuro ? ICON_PATHS.moon : ICON_PATHS.sun}
        size={16}
        stroke={oscuro ? '#8B5CF6' : '#94A3B8'}
      />
    </button>
  );
}
