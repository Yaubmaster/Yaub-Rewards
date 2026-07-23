'use client';

import { useEffect, useRef, useState } from 'react';

// Contador animado con easing cúbico (como el diseño)
export function AnimatedNumber({
  value,
  prefix = '$',
  duration = 1000,
}: {
  value: number;
  prefix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const raf = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current!);
  }, [value, duration]);

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {Math.round(display).toLocaleString('es-MX')}
    </span>
  );
}
