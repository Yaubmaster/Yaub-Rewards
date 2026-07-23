export const mxn = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-MX');

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// "+52 81 5555 0001" → "+52 81 •• ••01"
export const telEnmascarado = (tel: string) => {
  const digitos = (tel ?? '').replace(/\D/g, '');
  if (digitos.length < 4) return tel;
  const ultimos = digitos.slice(-2);
  const lada = digitos.length >= 12 ? digitos.slice(-12, -8) : digitos.slice(0, 2);
  const ladaFmt = digitos.length >= 12 ? `+${lada.slice(0, 2)} ${lada.slice(2)}` : lada;
  return `${ladaFmt} •• ••${ultimos}`;
};

export const tiempoRelativo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'ayer';
  return `hace ${Math.floor(s / 86400)} días`;
};
