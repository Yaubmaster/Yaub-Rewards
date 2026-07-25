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
  bot: 'M12 3v3 M8 8h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z M9.5 13.5h.01 M14.5 13.5h.01 M2 13.5h3 M19 13.5h3',
  globe:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  image:
    'M3 5h18v14H3z M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5-11 9',
  gift: 'M20 12v9H4v-9 M2 7h20v5H2z M12 7v14 M12 7C10.5 7 8 6.5 8 4.5S10.5 2 12 7z M12 7c1.5 0 4-.5 4-2.5S13.5 2 12 7z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  send: 'M22 2 11 13 M22 2 15 22l-4-9-9-4z',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14 21 3',
  trash: 'M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 11v6 M14 11v6',
  plus: 'M12 5v14 M5 12h14',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1.5v2 M12 20.5v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1.5 12h2 M20.5 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
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
