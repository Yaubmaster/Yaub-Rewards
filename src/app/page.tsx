import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export default async function Bienvenida() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (freelancer) redirect('/app');
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (empresa) redirect('/empresa');
    redirect('/registro/finalizar');
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), #FFFFFF',
      }}
    >
      <div className="w-full max-w-[420px] animate-fadeUp text-center">
        <img src="/rewards/yaub-icon.png" alt="Yaub" className="mx-auto mb-5 h-auto w-[84px]" />
        <h1 className="text-[34px] font-extrabold tracking-[-0.03em]">Yaub Rewards</h1>
        <p className="mt-2.5 text-base leading-relaxed text-slate2" style={{ textWrap: 'pretty' }}>
          Refiere clientes, los agentes de IA de Yaub cierran la venta, y tú cobras la comisión.
        </p>
        <Link
          href="/registro"
          className="btn-gradient mt-8 block py-[15px] text-base"
          style={{ boxShadow: '0 8px 24px rgba(139,92,246,.25)' }}
        >
          Comenzar
        </Link>
        <Link
          href="/login"
          className="mt-3.5 block text-sm font-semibold text-slate2 transition-colors hover:text-ink"
        >
          Entrar con mi cuenta Yaub →
        </Link>
        <p className="mt-1.5 text-xs text-slate3">
          Es la misma cuenta que usas en yaub.ai
        </p>
      </div>
    </div>
  );
}
