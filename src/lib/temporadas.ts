// Temporadas Yaub: cada trimestre natural es una temporada, igual que en la
// base (rewards.temporada_de). La clave canónica es 'YYYY-Tn' — T1 ene–mar,
// T2 abr–jun, T3 jul–sep, T4 oct–dic — y se calcula en hora de México, así que
// aquí solo se formatea: la clave siempre viene del servidor.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface Temporada {
  clave: string;
  anio: number;
  trimestre: number;
}

export function parseTemporada(clave: string): Temporada | null {
  const m = /^(\d{4})-T([1-4])$/.exec((clave ?? '').trim().toUpperCase());
  if (!m) return null;
  return { clave: m[0], anio: Number(m[1]), trimestre: Number(m[2]) };
}

/** 'Temporada 3 · 2026' */
export function nombreTemporada(clave: string): string {
  const t = parseTemporada(clave);
  return t ? `Temporada ${t.trimestre} · ${t.anio}` : clave;
}

/** 'T3 2026' — para los chips del filtro */
export function etiquetaTemporada(clave: string): string {
  const t = parseTemporada(clave);
  return t ? `T${t.trimestre} ${t.anio}` : clave;
}

/** 'Jul – Sep' */
export function mesesTemporada(clave: string): string {
  const t = parseTemporada(clave);
  if (!t) return '';
  const i = (t.trimestre - 1) * 3;
  return `${MESES[i]} – ${MESES[i + 2]}`;
}
