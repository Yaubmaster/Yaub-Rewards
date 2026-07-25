// Cliente del backend de la consola "Agentes Yaub Conectados"
// (edge function rewards-agentes). Solo se usa desde componentes cliente.
import { supabaseBrowser } from '@/lib/supabase/client';

export interface TrialInfo {
  assistant_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  paused_at: string | null;
  activated_at: string | null;
}

export interface AgenteResumen {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  widget_public_key: string | null;
  widget_config: { enabled?: boolean } | null;
  source: string;
  trial: TrialInfo | null;
}

export interface ContextoConocimiento {
  id: string;
  title: string;
  content_type: string;
  file_url: string | null;
  created_at: string;
  metadata: { texto_extraido?: boolean; url?: string } | null;
}

export interface ContextoImagen {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  created_at: string;
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

// Días de prueba restantes (0 si ya venció)
export function diasRestantes(trial: TrialInfo | null): number {
  if (!trial) return 0;
  const ms = new Date(trial.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export type EstadoAgente = 'activo' | 'prueba' | 'pausado';

export function estadoAgente(a: AgenteResumen): EstadoAgente {
  if (a.trial?.activated_at) return 'activo';
  if (a.trial) {
    if (a.trial.paused_at || !a.is_active || diasRestantes(a.trial) === 0) return 'pausado';
    return 'prueba';
  }
  return a.is_active ? 'activo' : 'pausado';
}
