import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Oferta } from '@/lib/types';
import { OfertaClient } from './OfertaClient';

export const dynamic = 'force-dynamic';

export default async function MiOferta() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!empresa) redirect('/registro/finalizar');

  const { data: ofertas } = await supabase
    .from('ofertas')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('created_at');

  return <OfertaClient empresaId={empresa.id} ofertasIniciales={(ofertas ?? []) as Oferta[]} />;
}
