import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/Shell';
import { supabaseServer } from '@/lib/supabase/server';

const NAV: NavItem[] = [
  { href: '/empresa', label: 'Dashboard', icon: 'grid' },
  { href: '/empresa/oferta', label: 'Mi oferta', icon: 'tag' },
  { href: '/empresa/freelancers', label: 'Freelancers', icon: 'users' },
  { href: '/empresa/referidos', label: 'Referidos', icon: 'list' },
];

export default async function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: empresa } = await supabase
    .from('empresas')
    .select('nombre, estado')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!empresa) redirect('/registro/finalizar');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <Shell
      navItems={NAV}
      roleLabel={`Empresa · ${empresa.nombre}`}
      switchTo={freelancer ? { href: '/app', label: 'Cambiar a Freelancer' } : undefined}
    >
      {empresa.estado === 'en_revision' && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3 text-[13px] font-medium text-[#B45309]">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-amber1" />
          Tu empresa está en revisión. En cuanto la autoricemos aparecerá en el marketplace de
          freelancers.
        </div>
      )}
      {children}
    </Shell>
  );
}
