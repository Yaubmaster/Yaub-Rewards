'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PasoCodigo, PasoEmpresas } from '@/components/onboarding/PasosFreelancer';
import type { Freelancer } from '@/lib/types';

type Paso = 'datos' | 'confirmar' | 'codigo' | 'empresas';

export default function RegistroFreelancer() {
  const [paso, setPaso] = useState<Paso>('datos');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);

  const registrar = async () => {
    setError(null);
    setCargando(true);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/rewards/auth/callback`,
        data: {
          full_name: nombre,
          phone: telefono,
          rol: 'freelancer',
          // Evita que el trigger de la plataforma Yaub cree un tenant self-service
          app_user_id: '00000000-0000-0000-0000-000000000000',
          password_change_required: false,
          is_self_signup: false,
        },
      },
    });
    if (err) {
      setCargando(false);
      setError(
        err.message.includes('already registered')
          ? 'Ese correo ya tiene cuenta. Inicia sesión.'
          : err.message,
      );
      return;
    }
    if (data.session) {
      // Sin confirmación de correo: crea el perfil y muestra el código
      const { data: fl, error: rpcErr } = await supabase
        .rpc('registrar_freelancer', { p_nombre: nombre, p_telefono: telefono })
        .single();
      setCargando(false);
      if (rpcErr || !fl) {
        setError('No se pudo crear tu perfil. Intenta de nuevo.');
        return;
      }
      setFreelancer(fl as Freelancer);
      setPaso('codigo');
    } else {
      // Confirmación de correo requerida
      setCargando(false);
      setPaso('confirmar');
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), #FFFFFF',
      }}
    >
      <div className="w-full max-w-[420px]">
        {paso === 'datos' && (
          <div className="animate-fadeUp">
            <div className="text-[13px] font-semibold text-slate3">PASO 1 DE 3</div>
            <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Tus datos</h1>
            <div className="mt-6 flex flex-col gap-3">
              <input className="input-yaub" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
              <input className="input-yaub" placeholder="Teléfono (WhatsApp)" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
              <input className="input-yaub" placeholder="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <input className="input-yaub" placeholder="Contraseña (mínimo 8 caracteres)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}
            <button
              onClick={registrar}
              disabled={cargando || !nombre.trim() || !email || password.length < 8}
              className="btn-gradient mt-6 w-full py-[15px] text-base disabled:opacity-60"
            >
              {cargando ? 'Creando tu cuenta…' : 'Continuar'}
            </button>
          </div>
        )}

        {paso === 'confirmar' && (
          <div className="animate-fadeUp text-center">
            <div className="mx-auto flex h-[72px] w-[72px] animate-pop items-center justify-center rounded-full text-3xl" style={{ background: 'rgba(0,212,255,.1)' }}>
              ✉️
            </div>
            <h1 className="mt-[18px] text-[26px] font-extrabold tracking-tight">Confirma tu correo</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate2" style={{ textWrap: 'pretty' }}>
              Te enviamos un enlace a <b>{email}</b>. Ábrelo para activar tu cuenta — al entrar te
              mostraremos tu código de vendedor.
            </p>
          </div>
        )}

        {paso === 'codigo' && freelancer && (
          <PasoCodigo codigo={freelancer.codigo} onContinuar={() => setPaso('empresas')} />
        )}

        {paso === 'empresas' && freelancer && <PasoEmpresas freelancerId={freelancer.id} />}
      </div>
    </div>
  );
}
