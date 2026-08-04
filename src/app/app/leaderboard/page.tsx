import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Leaderboard } from '@/lib/leaderboard';
import { LeaderboardClient } from './LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
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

  // Sin p_temporada = la temporada en curso. El RPC ya trae la lista de
  // temporadas para el filtro, así que es un solo viaje. La pestaña de "en
  // proceso" la pide el cliente cuando el usuario la toca.
  const { data } = await supabase.rpc('leaderboard_ventas', {
    p_temporada: null,
    p_metrica: 'cerradas',
  });

  return <LeaderboardClient inicial={(data ?? null) as Leaderboard | null} />;
}
