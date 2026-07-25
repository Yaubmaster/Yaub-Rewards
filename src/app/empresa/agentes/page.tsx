import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { AgentesClient } from './AgentesClient';

export const dynamic = 'force-dynamic';

export default async function AgentesPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // El listado sale del RPC mis_empresas_agentes: todas las empresas del
  // usuario, no solo la activa por cookie.
  return <AgentesClient />;
}
