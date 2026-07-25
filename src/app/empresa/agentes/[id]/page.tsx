import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { AgenteDetalleClient } from './AgenteDetalleClient';

export const dynamic = 'force-dynamic';

export default async function AgenteDetallePage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // La empresa dueña se resuelve desde el agente (1:1) en el cliente
  return <AgenteDetalleClient assistantId={params.id} />;
}
