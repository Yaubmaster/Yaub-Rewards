import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Freelancer, Referido } from '@/lib/types';
import { InicioClient } from './InicioClient';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
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

  const { data: referidos } = await supabase
    .from('referidos')
    .select('*')
    .eq('freelancer_id', freelancer.id)
    .order('created_at', { ascending: false });

  return (
    <InicioClient
      freelancer={freelancer as Freelancer}
      referidosIniciales={(referidos ?? []) as Referido[]}
    />
  );
}
