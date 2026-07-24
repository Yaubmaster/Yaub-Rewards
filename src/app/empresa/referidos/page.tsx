import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import type { ReferidoEmpresa } from '../DashboardClient';
import { ReferidosEmpresaClient } from './ReferidosEmpresaClient';

export const dynamic = 'force-dynamic';

export default async function ReferidosEmpresa() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  const { data: ofertas } = await supabase
    .from('ofertas')
    .select('id, condicion_liberacion')
    .eq('empresa_id', empresa.id);
  const ofertaIds = (ofertas ?? []).map((o) => o.id);
  const condicion = (ofertas ?? [])[0]?.condicion_liberacion ?? 'primera_recarga';

  const { data: referidos } = ofertaIds.length
    ? await supabase
        .from('referidos')
        .select('*, freelancers(nombre, codigo)')
        .in('oferta_id', ofertaIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  return (
    <ReferidosEmpresaClient
      referidosIniciales={(referidos ?? []) as unknown as ReferidoEmpresa[]}
      condicion={condicion}
    />
  );
}
