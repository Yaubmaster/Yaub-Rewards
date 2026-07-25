import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { NuevoAgenteClient } from './NuevoAgenteClient';

export const dynamic = 'force-dynamic';

export default async function NuevoAgentePage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  return <NuevoAgenteClient empresaId={empresa.id} empresaNombre={empresa.nombre} />;
}
