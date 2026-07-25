'use client';

// Confetti de celebración sin librerías (el repo es CSS puro a propósito).
// Render: overlay fijo con ~48 piezas que caen y giran; se desmonta solo.
import { useEffect, useMemo, useState } from 'react';

const COLORES = ['#00D4FF', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9'];

export function Confetti({ onFin }: { onFin?: () => void }) {
  const [visible, setVisible] = useState(true);

  const piezas = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.6 + Math.random() * 1.4,
        size: 6 + Math.random() * 7,
        color: COLORES[i % COLORES.length],
        rot: Math.random() * 360,
        redondo: Math.random() > 0.6,
      })),
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onFin?.();
    }, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes rewardsConfetti {
          0% { transform: translateY(-6vh) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {piezas.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.redondo ? p.size : p.size * 1.8,
            background: p.color,
            borderRadius: p.redondo ? '50%' : 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `rewardsConfetti ${p.dur}s ${p.delay}s cubic-bezier(.25,.46,.45,.94) forwards`,
          }}
        />
      ))}
    </div>
  );
}
