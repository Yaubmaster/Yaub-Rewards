'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS } from '@/components/icons';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICON_PATHS;
}

export function Shell({
  navItems,
  roleLabel,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activo = (href: string) =>
    href === navItems[0].href ? pathname === href : pathname.startsWith(href);

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar desktop */}
      <div className="fixed bottom-0 left-0 top-0 z-20 hidden w-60 flex-col border-r border-line bg-white px-3.5 py-6 md:flex">
        <div className="flex items-center gap-2.5 px-2.5 pb-[22px]">
          <Image src="/yaub-icon.png" alt="Yaub" width={32} height={32} className="h-8 w-auto" />
          <div>
            <div className="text-[15px] font-extrabold tracking-tight">Yaub Rewards</div>
            <div className="text-[11px] text-slate3">{roleLabel}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((it) => {
            const on = activo(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-[11px] transition-colors hover:bg-surface ${on ? 'bg-surface' : ''}`}
              >
                <Icon d={ICON_PATHS[it.icon]} stroke={on ? '#0A0A0F' : '#94A3B8'} />
                <span
                  className="text-sm"
                  style={{ fontWeight: on ? 700 : 500, color: on ? '#0A0A0F' : '#94A3B8' }}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-[11px] transition-colors hover:bg-red-50"
          >
            <Icon d={ICON_PATHS.logout} size={18} stroke="#EF4444" />
            <span className="text-[13px] font-semibold text-red-500">Cerrar sesión</span>
          </button>
        </div>
      </div>
      <div className="hidden w-60 shrink-0 md:block" />

      {/* Contenido */}
      <div className="min-w-0 flex-1 pb-[86px] md:pb-10">
        <div className="mx-auto max-w-[960px] p-4 pb-6 md:px-8 md:pt-8">
          {/* Header móvil */}
          <div className="flex items-center justify-between gap-2.5 pb-4 pt-1 md:hidden">
            <div className="flex items-center gap-[9px]">
              <Image src="/yaub-icon.png" alt="Yaub" width={26} height={26} className="h-[26px] w-auto" />
              <span className="text-[15px] font-extrabold tracking-tight">Yaub Rewards</span>
            </div>
            <button
              onClick={logout}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] border border-line bg-white transition-colors hover:border-red-400"
              aria-label="Cerrar sesión"
            >
              <Icon d={ICON_PATHS.logout} size={16} stroke="#EF4444" />
            </button>
          </div>
          {children}
        </div>
      </div>

      {/* Tab bar móvil */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-line px-2 pt-1.5 md:hidden"
        style={{
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(16px)',
          paddingBottom: 'calc(6px + env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map((it) => {
          const on = activo(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex min-h-[44px] flex-1 flex-col items-center gap-[3px] rounded-xl py-[7px] active:scale-95"
            >
              <Icon d={ICON_PATHS[it.icon]} size={22} strokeWidth={1.9} stroke={on ? '#0A0A0F' : '#94A3B8'} />
              <span
                className="text-[10px]"
                style={{ fontWeight: on ? 700 : 500, color: on ? '#0A0A0F' : '#94A3B8' }}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
