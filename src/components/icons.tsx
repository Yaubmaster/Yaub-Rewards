// Íconos de trazo (paths del diseño aprobado en design/)
export const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M15 3.13a4 4 0 0 1 0 7.75',
  store: 'M3 9l1.5-5h15L21 9 M5 9v12h14V9 M9 21v-6h6v6',
  cap: 'M22 10 12 5 2 10l10 5 10-5z M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  grid: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  tag: 'M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  check: 'M4 12.5 9.5 18 20 6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 7v5l3.5 2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  bank: 'M3 10h18 M3 10 12 4l9 6 M5 10v8 M9 10v8 M15 10v8 M19 10v8 M3 20h18',
  medal:
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M8.5 14 7 22l5-3 5 3-1.5-8',
  shield: 'M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z',
} as const;

export function Icon({
  d,
  size = 20,
  stroke = 'currentColor',
  strokeWidth = 1.8,
  className,
}: {
  d: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
