import Link from 'next/link';
import { Icon, ICON_PATHS } from '@/components/icons';

export default function ElegirRol() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), rgb(var(--fondo))',
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

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-slate3">¿ya tienes cuenta?</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* Una sola identidad Yaub: la cuenta de yaub.ai/platform sirve aquí y viceversa */}
        <Link
          href="/login"
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-line bg-white py-[13px] text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-cyan1"
          style={{ boxShadow: '0 2px 8px rgba(10,10,15,.04)' }}
        >
          <img src="/rewards/yaub-icon.png" alt="" className="logo-yaub h-5 w-auto" />
          Entrar con Yaub
        </Link>
        <p className="mt-2.5 text-center text-xs text-slate3">
          Una sola cuenta para yaub.ai, la plataforma y Rewards.
        </p>
      </div>
    </div>
  );
}
