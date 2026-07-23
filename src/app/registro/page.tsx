import Link from 'next/link';
import { Icon, ICON_PATHS } from '@/components/icons';

export default function ElegirRol() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), #FFFFFF',
      }}
    >
      <div className="w-full max-w-[420px] animate-fadeUp">
        <h1 className="text-center text-[26px] font-extrabold tracking-tight">
          ¿Cómo quieres usar Yaub Rewards?
        </h1>

        <Link
          href="/registro/freelancer"
          className="mt-7 block cursor-pointer rounded-[20px] border border-line bg-white p-[22px] transition-all hover:-translate-y-0.5 hover:border-cyan1"
          style={{ boxShadow: '0 2px 8px rgba(10,10,15,.04)' }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-badge">
            <Icon d={ICON_PATHS.user} size={22} stroke="#fff" strokeWidth={2} />
          </div>
          <div className="mt-3 text-lg font-bold">Quiero vender</div>
          <div className="mt-1 text-sm text-slate2">
            Soy freelancer. Comparto mi código y gano comisiones.
          </div>
        </Link>

        <Link
          href="/registro/empresa"
          className="mt-3.5 block cursor-pointer rounded-[20px] border border-line bg-white p-[22px] transition-all hover:-translate-y-0.5 hover:border-violet1"
          style={{ boxShadow: '0 2px 8px rgba(10,10,15,.04)' }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface">
            <Icon d={ICON_PATHS.store} size={22} stroke="#0A0A0F" strokeWidth={2} />
          </div>
          <div className="mt-3 text-lg font-bold">Soy empresa</div>
          <div className="mt-1 text-sm text-slate2">
            Quiero una red de vendedores conectada a mis agentes Yaub.
          </div>
        </Link>

        <p className="mt-6 text-center text-sm text-slate3">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-[#0EA5E9] hover:text-violet1">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
