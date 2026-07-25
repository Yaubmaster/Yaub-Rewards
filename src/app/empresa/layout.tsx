import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/Shell';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { EmpresaSelector } from './EmpresaSelector';

const NAV: NavItem[] = [
  { href: '/empresa', label: 'Dashboard', icon: 'grid' },
  { href: '/empresa/agentes', label: 'Agentes', icon: 'bot' },
  { href: '/empresa/oferta', label: 'Mi oferta', icon: 'tag' },
  { href: '/empresa/freelancers', label: 'Freelancers', icon: 'users' },
  { href: '/empresa/referidos', label: 'Referidos', icon: 'list' },
  { href: '/empresa/cuenta', label: 'Cuenta', icon: 'user' },
];

export default async function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { empresa, empresas } = await empresaActiva(supabase, user.id);

  // Si aún no registró empresa pero YA tiene agentes en su cuenta de Yaub, el
  // panel se abre igual: cada agente es una empresa que puede activar aquí.
  if (!empresa) {
    const { data: puede } = await supabase.rpc('tengo_panel_empresa');
    if (!puede) redirect('/registro/finalizar');
  }

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <Shell
      navItems={NAV}
      roleLabel={empresa ? `Empresa · ${empresa.nombre}` : 'Empresa'}
      switchTo={freelancer ? { href: '/app', label: 'Cambiar a Freelancer' } : undefined}
    >
      {empresas.length > 0 && empresa && (
        <EmpresaSelector empresas={empresas} activaId={empresa.id} />
      )}
      {empresa?.estado === 'en_revision' && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3 text-[13px] font-medium text-[#B45309]">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-amber1" />
          Esta empresa está en revisión. En cuanto la autoricemos aparecerá en el marketplace de
          freelancers.
        </div>
      )}
      {/* La `key` es a propósito: al cambiar de empresa, `router.refresh()`
          vuelve a pedir los datos al servidor, pero React conserva el estado de
          los componentes cliente que están en la misma posición del árbol —
          y esas pantallas guardan los datos del servidor en useState. Sin la
          key se quedaban los referidos y las ofertas de la empresa anterior.
          Cambiar la key desmonta el subárbol y arranca de cero. */}
      <Fragment key={empresa?.id ?? 'sin-empresa'}>{children}</Fragment>
    </Shell>
  );
}
