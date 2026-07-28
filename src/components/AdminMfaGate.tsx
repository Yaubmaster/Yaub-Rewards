'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { evaluateMfaGate, markMfaVerified, trustThisBrowser, MFA_TRUST_DAYS, MfaGateResult } from '@/lib/mfaTrust';

/**
 * Gate de 2FA para /admin: envuelve el contenido y no lo muestra hasta que el
 * staff enrole TOTP (primera vez) o verifique su código, salvo navegador con
 * confianza vigente (7 días). Port del MfaModal de yaub-platform.
 */
export default function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<MfaGateResult | 'loading'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const enrollStartedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setGate('challenge'); return; }
      setUserId(user.id);
      setGate(await evaluateMfaGate(user.id));
    })();
  }, []);

  useEffect(() => {
    if (gate !== 'enroll' || enrollStartedRef.current) return;
    enrollStartedRef.current = true;
    (async () => {
      const supabase = supabaseBrowser();
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        for (const f of factors?.all ?? []) {
          if (f.factor_type === 'totp' && f.status !== 'verified') {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Yaub Rewards Admin',
        });
        if (enrollError) throw enrollError;
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setTotpSecret(data.totp.secret);
      } catch (err: any) {
        console.error('[MFA] enroll error:', err);
        setError(err.message || 'No se pudo iniciar el enrolamiento');
      }
    })();
  }, [gate]);

  if (gate === null) return <>{children}</>;

  if (gate === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Ingresa el código de 6 dígitos de tu app de autenticación');
      return;
    }
    setLoading(true);
    const supabase = supabaseBrowser();
    try {
      let fid = factorId;
      if (gate === 'challenge') {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;
        fid = (factors?.totp ?? []).find(f => f.status === 'verified')?.id ?? null;
      }
      if (!fid) throw new Error('No se encontró el factor TOTP');
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: fid });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: fid,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw new Error('Código incorrecto o expirado. Inténtalo de nuevo.');

      if (userId) {
        markMfaVerified(userId);
        if (trust) await trustThisBrowser(userId);
      }
      setGate(null);
    } catch (err: any) {
      console.error('[MFA] verify error:', err);
      setError(err.message || 'No se pudo verificar el código');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  const qrSrc = qrCode
    ? (qrCode.startsWith('data:') ? qrCode : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            {gate === 'enroll' ? 'Configura tu 2FA' : 'Verificación en dos pasos'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Requerido para el panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-red-300 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {gate === 'enroll' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Escanea este código con tu app de autenticación (Google Authenticator,
                Microsoft Authenticator, 1Password…) y luego ingresa el código de 6 dígitos.
              </p>
              <div className="flex justify-center">
                {qrSrc ? (
                  <img src={qrSrc} alt="Código QR para 2FA" className="h-44 w-44 rounded-xl border border-slate-200 bg-white" />
                ) : (
                  <div className="h-44 w-44 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                )}
              </div>
              {totpSecret && (
                <p className="text-center text-xs text-slate-400">
                  ¿No puedes escanear? Clave manual: <span className="font-mono">{totpSecret}</span>
                </p>
              )}
            </div>
          )}

          {gate === 'challenge' && (
            <p className="text-sm text-slate-600">
              Ingresa el código de 6 dígitos de tu app de autenticación para continuar.
            </p>
          )}

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
            placeholder="000000"
          />

          <label className="flex cursor-pointer select-none items-start gap-3">
            <input
              type="checkbox"
              checked={trust}
              onChange={(e) => setTrust(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Confiar en este navegador</span>
              {' '}— no volver a pedir el código aquí durante {MFA_TRUST_DAYS} días.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || code.length !== 6 || (gate === 'enroll' && !factorId)}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Verificando…' : (gate === 'enroll' ? 'Activar 2FA' : 'Verificar')}
          </button>
        </form>
      </div>
    </div>
  );
}
