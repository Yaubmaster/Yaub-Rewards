import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/Shell';
import { supabaseServer } from '@/lib/supabase/server';

const NAV: NavItem[] = [
  { href: '/app', label: 'Inicio', icon: 'home' },
  { href: '/app/referidos', label: 'Referidos', icon: 'users' },
  { href: '/app/empresas', label: 'Empresas', icon: 'store' },
  { href: '/app/capacitacion', label: 'Capacitación', icon: 'cap' },
  { href: '/app/perfil', label: 'Perfil', icon: 'user' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('codigo')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!freelancer) redirect('/registro/finalizar');

  // limit(1) y no maybeSingle(): el usuario puede tener varias empresas
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  const tieneEmpresa = (empresas ?? []).length > 0;

  return (
    <Shell
      navItems={NAV}
      roleLabel={`Freelancer · ${freelancer.codigo}`}
      switchTo={tieneEmpresa ? { href: '/empresa', label: 'Cambiar a Empresa' } : undefined}
    >
      {children}
    </Shell>
  );
}
