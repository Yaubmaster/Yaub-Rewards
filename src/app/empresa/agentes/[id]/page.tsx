import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { AgenteDetalleClient } from './AgenteDetalleClient';

export const dynamic = 'force-dynamic';

export default async function AgenteDetallePage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  return <AgenteDetalleClient empresaId={empresa.id} assistantId={params.id} />;
}
