// Leaderboard de la temporada. Todo sale del RPC `rewards.leaderboard_ventas`,
// que es security definer porque los vendedores no se pueden leer entre sí por
// RLS.
//
// El RPC expone a propósito solo nombre, foto y conteos: el ranking compara
// volumen, nunca dinero. Ningún monto viaja al cliente.
import { supabaseBrowser } from '@/lib/supabase/client';

/** Por qué columna se rankea: ventas cerradas (oficial) o referidos en proceso */
export type Metrica = 'cerradas' | 'en_proceso';

export interface LeaderboardFila {
  /** Único por fila (sirve de key); a igual número va primero quien llegó antes */
  orden: number;
  /** Posición en la tabla; empata (1, 2, 2, 4) como en cualquier ranking deportivo */
  posicion: number;
  nombre: string;
  avatar_url: string | null;
  /** El número por el que se está rankeando ahora mismo */
  puntos: number;
  ventas: number;
  en_proceso: number;
  ultima: string | null;
  es_tu: boolean;
}

export interface LeaderboardRival {
  nombre: string;
  posicion: number;
  puntos: number;
  /** Cuántos te faltan para alcanzarlo */
  faltan: number;
}

export interface LeaderboardYo {
  nombre: string;
  avatar_url: string | null;
  puntos: number;
  ventas: number;
  en_proceso: number;
  /** null si todavía no tienes nada en la métrica que estás viendo */
  posicion: number | null;
  en_tabla: boolean;
  rival: LeaderboardRival | null;
}

export interface LeaderboardTemporada {
  clave: string;
  inicio: string;
  fin: string;
  actual: boolean;
  dias_restantes: number;
  /** 0..1 — qué tanto avanzó la temporada */
  progreso: number;
}

export interface Leaderboard {
  metrica: Metrica;
  temporada: LeaderboardTemporada;
  /** Claves disponibles, de la más nueva a la más vieja. No cambia con la métrica. */
  temporadas: string[];
  totales: { vendedores: number; puntos: number };
  tabla: LeaderboardFila[];
  yo: LeaderboardYo | null;
}

export async function cargarLeaderboard(
  temporada?: string,
  metrica: Metrica = 'cerradas',
): Promise<Leaderboard> {
  const { data, error } = await supabaseBrowser().rpc('leaderboard_ventas', {
    p_temporada: temporada ?? null,
    p_metrica: metrica,
  });
  if (error) throw new Error('No se pudo cargar el ranking.');
  return data as unknown as Leaderboard;
}

/** Copy que cambia entre las dos tablas, en un solo lugar */
export const METRICAS: Record<
  Metrica,
  {
    tab: string;
    unidad: (n: number) => string;
    heroLabel: string;
    /** Degradado del hero cuando sí tienes posición */
    gradiente: string;
    sombra: string;
    vacio: { emoji: string; titulo: string; texto: string };
    nota: string;
  }
> = {
  cerradas: {
    tab: 'Ventas cerradas',
    unidad: (n) => (n === 1 ? 'venta cerrada' : 'ventas cerradas'),
    heroLabel: 'TU POSICIÓN · CERRADAS',
    gradiente: 'linear-gradient(135deg,#00D4FF,#8B5CF6)',
    sombra: '0 12px 32px rgba(139,92,246,.22)',
    vacio: {
      emoji: '🏁',
      titulo: 'La temporada está en blanco',
      texto: 'Nadie ha cerrado una venta todavía. Puedes ser el primero en aparecer aquí.',
    },
    nota: 'Esta tabla cuenta ventas cerradas (liberadas o pagadas), no dinero. Las comisiones de cada quien son privadas y nadie más las ve.',
  },
  en_proceso: {
    tab: 'En proceso',
    unidad: (n) => (n === 1 ? 'referido en proceso' : 'referidos en proceso'),
    heroLabel: 'TU POSICIÓN · EN PROCESO',
    gradiente: 'linear-gradient(135deg,#F59E0B,#EF4444)',
    sombra: '0 12px 32px rgba(245,158,11,.22)',
    vacio: {
      emoji: '🌱',
      titulo: 'Nadie tiene referidos en proceso',
      texto: 'Cuando alguien capture un prospecto con su código, aparecerá aquí antes de cerrar.',
    },
    nota: 'Esta tabla cuenta referidos capturados que aún no se liberan. Sirve para ver quién está moviendo la aguja esta semana, aunque todavía no cierre.',
  },
};
