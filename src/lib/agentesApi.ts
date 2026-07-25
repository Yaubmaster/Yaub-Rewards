// Cliente de la consola "Agentes Yaub Conectados".
//
// Modelo: cada EMPRESA de Rewards es UN agente (1:1). El listado sale del RPC
// `mis_empresas_agentes` (una sola llamada, ya trae el consumo del trial); las
// escrituras van por la edge function `rewards-agentes`, que valida la sesión y
// escribe con service role.
import { supabaseBrowser } from '@/lib/supabase/client';

export const INTERACCIONES_TRIAL = 100;

export interface AgenteDeEmpresa {
  id: string;
  nombre: string;
  activo: boolean;
  widget_key: string | null;
  interacciones_incluidas: number;
  interacciones_usadas: number;
  trial_activo: boolean;
  activado: boolean;
  pausado: boolean;
}

export interface EmpresaConAgente {
  empresa_id: string;
  empresa: string;
  estado: 'en_revision' | 'autorizada';
  creada: string;
  tenant_id: string | null;
  ofertas: number;
  agente: AgenteDeEmpresa | null;
}

export interface ContextoConocimiento {
  id: string;
  title: string;
  content_type: string;
  file_url: string | null;
  created_at: string;
  metadata: { texto_extraido?: boolean; url?: string; tipo?: string } | null;
}

export interface ContextoImagen {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  created_at: string;
}

/** Empresas del usuario con su agente y el consumo del trial. */
export async function misEmpresasAgentes(): Promise<EmpresaConAgente[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.rpc('mis_empresas_agentes');
  if (error) throw new Error('No pudimos cargar tus agentes. Intenta de nuevo.');
  return (data ?? []) as unknown as EmpresaConAgente[];
}

export async function agentesApi<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<T & { ok: true }> {
  const supabase = supabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rewards-agentes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    },
  ).catch(() => null);
  const out = res ? await res.json().catch(() => null) : null;
  if (!out?.ok) throw new Error(out?.error ?? 'No hay conexión. Intenta de nuevo.');
  return out;
}

export type EstadoAgente = 'sin_agente' | 'prueba' | 'activo' | 'agotado';

export function estadoAgente(a: AgenteDeEmpresa | null): EstadoAgente {
  if (!a) return 'sin_agente';
  if (a.activado) return 'activo';
  if (a.pausado || a.interacciones_usadas >= a.interacciones_incluidas) return 'agotado';
  return 'prueba';
}

/** Interacciones gratis que le quedan al agente (0 si ya se agotaron). */
export function interaccionesRestantes(a: AgenteDeEmpresa | null): number {
  if (!a) return 0;
  return Math.max(0, a.interacciones_incluidas - a.interacciones_usadas);
}
