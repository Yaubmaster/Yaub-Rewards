import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { AgenteDetalleClient } from './AgenteDetalleClient';

export const dynamic = 'force-dynamic';

export default async function AgenteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // La empresa dueña se resuelve desde el agente (1:1) en el cliente
  return <AgenteDetalleClient assistantId={id} />;
}
