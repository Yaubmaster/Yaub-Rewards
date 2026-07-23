import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ReferidosClient, type ReferidoConEmpresa } from './ReferidosClient';

export const dynamic = 'force-dynamic';

export default async function Referidos() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('id, codigo')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!freelancer) redirect('/registro/finalizar');

  const { data: referidos } = await supabase
    .from('referidos')
    .select('*, ofertas(producto, empresas(nombre))')
    .eq('freelancer_id', freelancer.id)
    .order('created_at', { ascending: false });

  return (
    <ReferidosClient
      referidos={(referidos ?? []) as unknown as ReferidoConEmpresa[]}
      codigo={freelancer.codigo}
    />
  );
}
