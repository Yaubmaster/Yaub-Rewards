import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Freelancer, Pago } from '@/lib/types';
import { PerfilClient } from './PerfilClient';

export const dynamic = 'force-dynamic';

export default async function Perfil() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!freelancer) redirect('/registro/finalizar');

  const [{ data: pagos }, { data: referidos }] = await Promise.all([
    supabase
      .from('pagos')
      .select('*')
      .eq('freelancer_id', freelancer.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('referidos')
      .select('monto_mxn, estatus')
      .eq('freelancer_id', freelancer.id),
  ]);

  const total = (referidos ?? [])
    .filter((r) => r.estatus === 'liberado' || r.estatus === 'pagado')
    .reduce((s, r) => s + Number(r.monto_mxn), 0);

  return (
    <PerfilClient
      freelancer={freelancer as Freelancer}
      pagos={(pagos ?? []) as Pago[]}
      totalHistorico={total}
    />
  );
}
