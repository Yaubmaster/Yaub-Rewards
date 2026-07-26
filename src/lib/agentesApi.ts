// Cliente de la consola "Agentes Yaub Conectados".
//
// Modelo: cada EMPRESA de Rewards es UN agente (1:1). El listado sale del RPC
// `mis_empresas_agentes` (una sola llamada, ya trae el consumo del trial); las
// escrituras van por la edge function `rewards-agentes`, que valida la sesión y
// escribe con service role.
import { supabaseBrowser } from '@/lib/supabase/client';

export const INTERACCIONES_TRIAL = 100;
/** Plan de entrada de Yaub tras agotar la prueba (los demás se ven en platform). */
export const PLAN_MENSUAL = '$99/mes por 500 interacciones';

/** Un agente de las cuentas Yaub del usuario, con su activación en Rewards. */
export interface AgenteDeCuenta {
  assistant_id: string;
  nombre: string;
  tenant_id: string;
  tenant: string;
  avatar_url: string | null;
  tenant_avatar: string | null;
  activo: boolean;
  widget_key: string | null;
  /** Tiene cableada la skill de Rewards (registrar_referido / validar_codigo) */
  rewards_activo: boolean;
  empresa_id: string | null;
  ofertas: number;
  interacciones_incluidas: number;
  interacciones_usadas: number;
  con_plan: boolean;
}

/** Un número de WhatsApp ligado al agente (public.whatsapp_numbers). */
export interface NumeroWhatsApp {
  id: string;
  numero: string;
  nombre: string | null;
  activo: boolean;
}

export interface AgenteDeEmpresa {
  id: string;
  nombre: string;
  avatar_url: string | null;
  whatsapp: NumeroWhatsApp[];
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

/**
 * Guarda la foto del agente. Va por RPC SECURITY INVOKER: la RLS de la
 * plataforma decide si esta cuenta puede editar ese agente.
 */
export async function guardarAvatarAgente(assistantId: string, url: string | null): Promise<void> {
  const { error } = await supabaseBrowser().rpc('guardar_avatar_agente', {
    p_assistant_id: assistantId,
    p_url: url ?? '',
  });
  if (error) {
    throw new Error(
      error.message?.includes('permiso')
        ? 'Solo el dueño de la cuenta Yaub puede cambiar la foto de este agente.'
        : 'No se pudo guardar la foto.',
    );
  }
}

/**
 * Prende el chat web del agente si no lo tiene, para que se pueda probar aquí
 * mismo. Genera la llave `wk_` y agrega rewards.yaub.ai a allowed_domains sin
 * pisar el resto de la configuración del widget. Es idempotente.
 */
export async function asegurarChatWeb(assistantId: string): Promise<string | null> {
  const { data, error } = await supabaseBrowser().rpc('asegurar_chat_web', {
    p_assistant_id: assistantId,
  });
  if (error) return null; // sin permiso: se queda sin chat aquí, no es fatal
  return ((data ?? null) as { widget_key?: string } | null)?.widget_key ?? null;
}

/** Cuentas (tenants) de Yaub que el usuario puede administrar desde Rewards. */
export interface CuentaYaub {
  tenant_id: string;
  nombre: string;
  avatar_url: string | null;
  agentes: number;
}

export async function misCuentas(): Promise<CuentaYaub[]> {
  const { data, error } = await supabaseBrowser().rpc('mis_tenants');
  if (error) throw new Error('No pudimos cargar tus cuentas de Yaub.');
  return (data ?? []) as unknown as CuentaYaub[];
}

export async function guardarAvatarCuenta(tenantId: string, url: string | null): Promise<void> {
  const { error } = await supabaseBrowser().rpc('guardar_avatar_tenant', {
    p_tenant_id: tenantId,
    p_url: url ?? '',
  });
  if (error) {
    throw new Error(
      error.message?.includes('permiso')
        ? 'Solo el dueño de esta cuenta de Yaub puede cambiarle el logo.'
        : 'No se pudo guardar el logo.',
    );
  }
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
