import type { SupabaseClient } from '@supabase/supabase-js';

export interface StatsLanding {
  comisionesPagadasMxn: number;
  vendedoresActivos: number;
  ventasCerradas: number;
  segundosRespuesta: number;
}

/**
 * Tiempo de respuesta del agente que se muestra en la landing.
 *
 * Es el único número de esa sección que NO sale de la base: no hay métrica de
 * latencia por conversación en el schema. Edítalo aquí cuando lo midas.
 */
export const SEGUNDOS_RESPUESTA_AGENTE = 9;

/**
 * Override manual de los números de "Números que motivan".
 *
 * Por defecto está vacío: la landing publica las cifras REALES que devuelve
 * `rewards.stats_publicas()` (comisiones efectivamente pagadas, vendedores
 * activos y ventas cerradas dentro de la plataforma).
 *
 * Solo pon un valor aquí si la cifra es real y la puedes respaldar — por
 * ejemplo, ventas hechas con una empresa aliada que todavía no se registran en
 * Rewards. Estos números se publican como hechos a quien visita la página.
 *
 * Ejemplo:
 *   export const STATS_MANUALES: Partial<StatsLanding> = { ventasCerradas: 1200 };
 */
export const STATS_MANUALES: Partial<StatsLanding> = {};

const CERO: StatsLanding = {
  comisionesPagadasMxn: 0,
  vendedoresActivos: 0,
  ventasCerradas: 0,
  segundosRespuesta: SEGUNDOS_RESPUESTA_AGENTE,
};

/**
 * Lee los agregados públicos (sin PII) vía RPC `security definer`, ejecutable
 * por anon porque la landing la ven visitantes sin sesión.
 */
export async function obtenerStatsLanding(supabase: SupabaseClient): Promise<StatsLanding> {
  const { data } = await supabase.rpc('stats_publicas');
  const reales = (data ?? null) as Record<string, number | string> | null;

  const base: StatsLanding = reales
    ? {
        comisionesPagadasMxn: Number(reales.comisiones_pagadas_mxn ?? 0),
        vendedoresActivos: Number(reales.vendedores_activos ?? 0),
        ventasCerradas: Number(reales.ventas_cerradas ?? 0),
        segundosRespuesta: SEGUNDOS_RESPUESTA_AGENTE,
      }
    : CERO;

  return { ...base, ...STATS_MANUALES };
}
