// Leaderboard de ventas por temporada. Todo sale del RPC
// `rewards.leaderboard_ventas`, que es security definer porque los vendedores
// no se pueden leer entre sí por RLS.
//
// El RPC expone a propósito solo nombre, foto y número de ventas: el ranking
// compara volumen, nunca dinero. Ningún monto viaja al cliente.
import { supabaseBrowser } from '@/lib/supabase/client';

export interface LeaderboardFila {
  /** Único por fila (sirve de key); a igual número de ventas va primero quien llegó antes */
  orden: number;
  /** Posición en la tabla; empata (1, 2, 2, 4) como en cualquier ranking deportivo */
  posicion: number;
  nombre: string;
  avatar_url: string | null;
  ventas: number;
  en_proceso: number;
  ultima_venta: string | null;
  es_tu: boolean;
}

export interface LeaderboardRival {
  nombre: string;
  posicion: number;
  ventas: number;
  /** Ventas que te faltan para alcanzarlo */
  faltan: number;
}

export interface LeaderboardYo {
  nombre: string;
  avatar_url: string | null;
  ventas: number;
  en_proceso: number;
  /** null si todavía no cierras una venta en la temporada */
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
  temporada: LeaderboardTemporada;
  /** Claves disponibles, de la más nueva a la más vieja */
  temporadas: string[];
  totales: { vendedores: number; ventas: number };
  tabla: LeaderboardFila[];
  yo: LeaderboardYo | null;
}

export async function cargarLeaderboard(temporada?: string): Promise<Leaderboard> {
  const { data, error } = await supabaseBrowser().rpc('leaderboard_ventas', {
    p_temporada: temporada ?? null,
  });
  if (error) throw new Error('No se pudo cargar el ranking.');
  return data as unknown as Leaderboard;
}
