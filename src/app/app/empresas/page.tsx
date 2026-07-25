import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { MarketplaceClient } from './MarketplaceClient';

export const dynamic = 'force-dynamic';

export default async function Empresas() {
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

  // El marketplace sale del RPC ofertas_publicadas: solo ofertas en estado
  // "publicada", agrupadas por cuenta (tenant) -> agente -> ofertas.
  return <MarketplaceClient freelancerId={freelancer.id} />;
}
