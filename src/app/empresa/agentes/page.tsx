import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { AgentesClient } from './AgentesClient';

export const dynamic = 'force-dynamic';

export default async function AgentesPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  return <AgentesClient empresaId={empresa.id} />;
}
