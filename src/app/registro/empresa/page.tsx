'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS } from '@/components/icons';
import type { CapacitacionTipo } from '@/lib/types';

type Paso = 'datos' | 'oferta' | 'confirmar' | 'revision';

export default function RegistroEmpresa() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('datos');
  // Si ya hay sesión (ej. un freelancer que abre su "segunda oficina"),
  // saltamos el alta de cuenta y solo pedimos los datos de la empresa.
  const [sesionActiva, setSesionActiva] = useState<boolean>(false);

  useEffect(() => {
    const revisar = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (empresa) {
        router.replace('/empresa');
        return;
      }
      setSesionActiva(true);
    };
    revisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [nombre, setNombre] = useState('');
  const [giro, setGiro] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [producto, setProducto] = useState('');
  const [comision, setComision] = useState('');
  const [condicion, setCondicion] = useState('');
  const [capacitacion, setCapacitacion] = useState<CapacitacionTipo>('en_linea');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrarEmpresaConSesion = async () => {
    const supabase = supabaseBrowser();
    const comisionNum = parseFloat(comision.replace(/[^\d.]/g, '')) || 0;
    const { error: rpcErr } = await supabase.rpc('registrar_empresa', {
      p_nombre: nombre,
      p_descripcion: giro,
      p_producto: producto,
      p_comision_mxn: comisionNum,
      p_condicion: condicion,
      p_capacitacion: capacitacion,
    });
    setCargando(false);
    if (rpcErr) {
      setError('No se pudo registrar la empresa. Intenta de nuevo.');
      return;
    }
    setPaso('revision');
  };

  const enviar = async () => {
    setError(null);
    setCargando(true);
    if (sesionActiva) {
      await registrarEmpresaConSesion();
      return;
    }
    // Alta sin correo de confirmación: la edge function crea la cuenta ya
    // confirmada (admin API) y aquí iniciamos sesión de inmediato.
    const supabase = supabaseBrowser();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crear-cuenta-rewards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nombre,
          rol: 'empresa',
          empresa_nombre: nombre,
          empresa_descripcion: giro,
          empresa_producto: producto,
          empresa_comision: comision,
          empresa_condicion: condicion,
          empresa_capacitacion: capacitacion,
        }),
      },
    ).catch(() => null);
    const out = res ? await res.json().catch(() => null) : null;
    if (!out?.ok) {
      setCargando(false);
      setError(
        out?.error === 'ya_existe'
          ? 'Ese correo ya tiene cuenta. Inicia sesión.'
          : out?.error ?? 'No se pudo crear tu cuenta. Intenta de nuevo.',
      );
      return;
    }

    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) {
      setCargando(false);
      setError('Tu cuenta se creó pero no pudimos iniciar sesión. Entra desde "Iniciar sesión".');
      return;
    }
    await registrarEmpresaConSesion();
  };

  const chip = (tipo: CapacitacionTipo, label: string) => (
    <button
      key={tipo}
      onClick={() => setCapacitacion(tipo)}
      className="rounded-full border px-4 py-[9px] text-[13px] font-semibold transition-all"
      style={
        capacitacion === tipo
          ? { background: '#0A0A0F', color: '#fff', borderColor: '#0A0A0F' }
          : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
      }
    >
      {label}
    </button>
  );

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
            <div className="text-[13px] font-semibold text-slate3">EMPRESA · PASO 1 DE 2</div>
            <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Datos del negocio</h1>
            {sesionActiva && (
              <p className="mt-2 text-[13px] text-slate2">
                Usarás tu misma cuenta Yaub — solo dinos de tu negocio.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <input className="input-yaub input-yaub--violet" placeholder="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <input className="input-yaub input-yaub--violet" placeholder="Giro (ej. Telefonía móvil)" value={giro} onChange={(e) => setGiro(e.target.value)} />
              {!sesionActiva && (
                <>
                  <input className="input-yaub input-yaub--violet" placeholder="Correo de contacto" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  <input className="input-yaub input-yaub--violet" placeholder="Contraseña (mínimo 8 caracteres)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </>
              )}
            </div>
            <button
              onClick={() => setPaso('oferta')}
              disabled={!nombre.trim() || (!sesionActiva && (!email || password.length < 8))}
              className="mt-6 w-full rounded-2xl bg-ink py-[15px] text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              Continuar
            </button>
          </div>
        )}

        {paso === 'oferta' && (
          <div className="animate-fadeUp">
            <div className="text-[13px] font-semibold text-slate3">EMPRESA · PASO 2 DE 2</div>
            <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">¿Qué necesitas vender?</h1>
            <div className="mt-6 flex flex-col gap-3">
              <input className="input-yaub input-yaub--violet" placeholder="¿Qué venden? (ej. Portabilidades)" value={producto} onChange={(e) => setProducto(e.target.value)} />
              <input className="input-yaub input-yaub--violet" placeholder="Comisión por venta (ej. 100)" value={comision} onChange={(e) => setComision(e.target.value)} inputMode="decimal" />
              <input className="input-yaub input-yaub--violet" placeholder="Condición de liberación (ej. Primera recarga)" value={condicion} onChange={(e) => setCondicion(e.target.value)} />
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate3">CAPACITACIÓN QUE OFRECEN</div>
                <div className="flex gap-2">
                  {chip('en_linea', 'En línea')}
                  {chip('presencial', 'Presencial')}
                  {chip('ninguna', 'Ninguna')}
                </div>
              </div>
            </div>
            {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}
            <button
              onClick={enviar}
              disabled={cargando || !producto.trim()}
              className="btn-gradient mt-6 w-full py-[15px] text-base disabled:opacity-60"
            >
              {cargando ? 'Enviando…' : 'Enviar a revisión'}
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
              Te enviamos un enlace a <b>{email}</b>. Ábrelo para activar tu cuenta y enviar tu
              empresa a revisión.
            </p>
          </div>
        )}

        {paso === 'revision' && (
          <div className="animate-fadeUp text-center">
            <div className="mx-auto flex h-[72px] w-[72px] animate-pop items-center justify-center rounded-full" style={{ background: 'rgba(245,158,11,.12)' }}>
              <Icon d={ICON_PATHS.clock} size={32} stroke="#F59E0B" strokeWidth={2} />
            </div>
            <h1 className="mt-[18px] text-[26px] font-extrabold tracking-tight">En revisión</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate2" style={{ textWrap: 'pretty' }}>
              Estamos verificando tu empresa. En menos de 24 h quedarás autorizada en el marketplace.
            </p>
            <button
              onClick={() => {
                router.push('/empresa');
                router.refresh();
              }}
              className="mt-[26px] w-full rounded-2xl bg-ink py-[15px] text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Ir a mi panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
