import type { CSSProperties } from 'react';

// Los reveals de la landing usan `data-r` + la variable CSS `--r` para
// escalonar el delay (transition-delay: calc(var(--r) * 90ms)).
export const r = (n: number) => ({ '--r': n }) as CSSProperties;

// Assets oficiales (basePath /rewards)
export const ICONO_YAUB = '/rewards/yaub-icon.png';
export const LOGO_YAUB_MOVIL = '/rewards/logos/yaub-movil.png';
export const LOGO_ALIANZATEL = '/rewards/logos/alianzatel.png';
