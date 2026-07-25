import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { MisOfertasClient } from './MisOfertasClient';

export const dynamic = 'force-dynamic';

export default async function MisOfertas() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!freelancer) redirect('/registro/finalizar');

  return <MisOfertasClient freelancerId={freelancer.id} />;
}
