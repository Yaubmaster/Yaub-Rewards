import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

// Solo correos en ADMIN_EMAILS (y espejados en rewards.admins, que es lo que
// valida el RLS del lado de la base).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes((user.email ?? '').toLowerCase())) redirect('/');

  return <>{children}</>;
}
