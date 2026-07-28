'use client';

// 2FA obligatorio para el área /admin (staff) + "confiar en este navegador".
// Mismo modelo que yaub-platform (tabla public.trusted_devices + RPCs
// mfa_trust_device / mfa_validate_trusted_device del proyecto compartido):
//   - Sin factor TOTP verificado           → enrolamiento forzoso.
//   - Sesión aal2 con verificación fresca  → pasa.
//   - Sesión aal1 con dispositivo confiado → pasa (validación server-side).
//   - Cualquier otro caso                  → challenge forzoso.
// OJO: el cliente browser de Rewards fija db.schema='rewards'; los RPCs de
// MFA viven en public → siempre .schema('public').rpc(...).

import { supabaseBrowser } from '@/lib/supabase/client';

export const MFA_TRUST_DAYS = 7;
const FRESH_MS = MFA_TRUST_DAYS * 24 * 60 * 60 * 1000;

const deviceKey = (userId: string) => `yaub.mfa.device.${userId}`;
const verifiedKey = (userId: string) => `yaub.mfa.verifiedAt.${userId}`;

interface DeviceCreds {
  deviceId: string;
  secret: string;
}

function readDevice(userId: string): DeviceCreds | null {
  try {
    const raw = localStorage.getItem(deviceKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.deviceId === 'string' && typeof parsed?.secret === 'string') return parsed;
  } catch { /* localStorage bloqueado */ }
  return null;
}

export function markMfaVerified(userId: string) {
  try { localStorage.setItem(verifiedKey(userId), String(Date.now())); } catch { /* noop */ }
}

function verifiedFresh(userId: string): boolean {
  try {
    const at = Number(localStorage.getItem(verifiedKey(userId)) || 0);
    return at > 0 && Date.now() - at < FRESH_MS;
  } catch { return false; }
}

export async function trustThisBrowser(userId: string): Promise<boolean> {
  const supabase = supabaseBrowser();
  const existing = readDevice(userId);
  const creds: DeviceCreds = {
    deviceId: existing?.deviceId ?? crypto.randomUUID(),
    secret: crypto.randomUUID() + crypto.randomUUID(),
  };
  const { error } = await supabase.schema('public').rpc('mfa_trust_device', {
    p_device_id: creds.deviceId,
    p_secret: creds.secret,
    p_user_agent: navigator.userAgent,
  });
  if (error) {
    console.error('[MFA] trust_device error:', error);
    return false;
  }
  try { localStorage.setItem(deviceKey(userId), JSON.stringify(creds)); } catch { /* noop */ }
  return true;
}

export function forgetThisBrowser(userId: string) {
  try { localStorage.removeItem(deviceKey(userId)); } catch { /* noop */ }
}

export type MfaGateResult = 'enroll' | 'challenge' | null;

/** Para /admin el enforcement es incondicional (ya pasó el allowlist de correos). */
export async function evaluateMfaGate(userId: string): Promise<MfaGateResult> {
  const supabase = supabaseBrowser();

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) {
    console.error('[MFA] listFactors error:', factorsError);
    return null;
  }
  const verifiedTotp = (factorsData?.totp ?? []).filter(f => f.status === 'verified');
  if (verifiedTotp.length === 0) return 'enroll';

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2' && verifiedFresh(userId)) return null;

  const device = readDevice(userId);
  if (device) {
    const { data: ok, error } = await supabase.schema('public').rpc('mfa_validate_trusted_device', {
      p_device_id: device.deviceId,
      p_secret: device.secret,
    });
    if (!error && ok === true) return null;
    if (!error && ok === false) forgetThisBrowser(userId);
  }

  return 'challenge';
}
