import type { ReferidoEstatus } from '@/lib/types';

const ESTILOS: Record<ReferidoEstatus, { bg: string; c: string; label: string }> = {
  pendiente: { bg: 'rgba(245,158,11,.12)', c: '#F59E0B', label: 'Pendiente' },
  liberado: { bg: 'rgba(16,185,129,.1)', c: '#10B981', label: 'Liberado' },
  pagado: { bg: 'rgba(14,165,233,.1)', c: '#0EA5E9', label: 'Pagado' },
};

export function EstatusChip({ estatus }: { estatus: ReferidoEstatus }) {
  const e = ESTILOS[estatus];
  return (
    <div
      className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-semibold"
      style={{ background: e.bg, color: e.c }}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: e.c }} />
      {e.label}
    </div>
  );
}
