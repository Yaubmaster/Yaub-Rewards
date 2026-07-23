'use client';

import { useEffect, useState } from 'react';

// Gráfica de barras semanal con animación de entrada (como el diseño)
export function WeeklyChart({
  data,
  height = 130,
  showValues = false,
}: {
  data: { dia: string; valor: number }[];
  height?: number;
  showValues?: boolean;
}) {
  const [entrada, setEntrada] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntrada(true), 60);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.valor));

  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((b, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          {showValues && (
            <div className="text-xs font-bold text-slate2" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {b.valor}
            </div>
          )}
          <div
            className="w-full max-w-[36px] rounded-t-lg rounded-b"
            style={{
              background: 'linear-gradient(180deg,#00D4FF,#8B5CF6)',
              height: entrada ? `${Math.max(4, (b.valor / max) * 100)}%` : '4%',
              transition: 'height .8s cubic-bezier(.2,.8,.2,1)',
            }}
          />
          <div className="text-[11px] font-medium text-slate3">{b.dia}</div>
        </div>
      ))}
    </div>
  );
}
