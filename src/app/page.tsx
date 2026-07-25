import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { obtenerStatsLanding } from '@/lib/statsLanding';
import { LandingPage } from '@/components/landing/LandingPage';
import './landing.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Yaub Rewards — Tú refieres. La IA vende. Tú cobras.',
  description:
    'Comparte tu código único: los agentes de IA de Yaub atienden, cierran la venta y registran tu comisión solos. Gratis, para siempre.',
};

export default async function Bienvenida() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (freelancer) redirect('/app');
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    if (empresas && empresas.length > 0) redirect('/empresa');
    redirect('/registro/finalizar');
  }

  const stats = await obtenerStatsLanding(supabase);
  return <LandingPage stats={stats} />;
}
