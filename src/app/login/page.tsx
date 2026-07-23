'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modo, setModo] = useState<'password' | 'magic'>('password');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicEnviado, setMagicEnviado] = useState(false);

  const entrar = async () => {
    setError(null);
    setCargando(true);
    const supabase = supabaseBrowser();
    if (modo === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setCargando(false);
      if (error) {
        setError('Correo o contraseña incorrectos.');
        return;
      }
      router.push(params.get('next') ?? '/');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Solo usuarios existentes: el alta siempre pasa por /registro
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/rewards/auth/callback`,
        },
      });
      setCargando(false);
      if (error) {
        setError(
          error.message.toLowerCase().includes('signups')
            ? 'Ese correo no tiene cuenta. Regístrate primero.'
            : 'No se pudo enviar el enlace. Intenta de nuevo.',
        );
        return;
      }
      setMagicEnviado(true);
    }
  };

  if (magicEnviado) {
    return (
      <div className="animate-fadeUp text-center">
        <div className="mx-auto flex h-[72px] w-[72px] animate-pop items-center justify-center rounded-full" style={{ background: 'rgba(0,212,255,.1)' }}>
          ✉️
        </div>
        <h1 className="mt-[18px] text-[26px] font-extrabold tracking-tight">Revisa tu correo</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate2">
          Te enviamos un enlace mágico a <b>{email}</b>. Ábrelo para entrar a Yaub Rewards.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeUp">
      <Image src="/yaub-icon.png" alt="Yaub" width={56} height={56} className="mx-auto mb-[18px] block h-auto w-14" />
      <h1 className="text-center text-[26px] font-extrabold tracking-tight">Inicia sesión</h1>
      <p className="mt-1.5 text-center text-sm text-slate2">Bienvenido de vuelta a Yaub Rewards.</p>

      <div className="mt-[26px] flex flex-col gap-3">
        <input
          className="input-yaub"
          placeholder="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {modo === 'password' && (
          <input
            className="input-yaub"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
          />
        )}
      </div>

      {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}

      <button
        onClick={entrar}
        disabled={cargando || !email || (modo === 'password' && !password)}
        className="btn-gradient mt-[18px] w-full py-[15px] text-base disabled:opacity-60"
      >
        {cargando ? 'Un momento…' : modo === 'password' ? 'Entrar' : 'Enviarme enlace mágico'}
      </button>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-slate3">o</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <button
        onClick={() => {
          setModo(modo === 'password' ? 'magic' : 'password');
          setError(null);
        }}
        className="mt-4 w-full rounded-[14px] border border-line bg-white py-[13px] text-sm font-semibold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
      >
        {modo === 'password' ? 'Entrar con enlace mágico por correo' : 'Entrar con contraseña'}
      </button>

      <p className="mt-5 text-center text-sm text-slate3">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-[#0EA5E9] hover:text-violet1">
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export default function Login() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), #FFFFFF',
      }}
    >
      <div className="w-full max-w-[420px]">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
