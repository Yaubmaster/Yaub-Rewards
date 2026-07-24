import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import type { CapacitacionModulo, Oferta } from '@/lib/types';
import { OfertaClient } from './OfertaClient';

export const dynamic = 'force-dynamic';

export default async function MiOferta() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  const [{ data: ofertas }, { data: modulos }] = await Promise.all([
    supabase.from('ofertas').select('*').eq('empresa_id', empresa.id).order('created_at'),
    supabase
      .from('capacitacion_modulos')
      .select('*')
      .eq('empresa_id', empresa.id)
      .order('orden')
      .order('created_at'),
  ]);

  return (
    <OfertaClient
      empresaId={empresa.id}
      ofertasIniciales={(ofertas ?? []) as Oferta[]}
      modulosIniciales={(modulos ?? []) as CapacitacionModulo[]}
    />
  );
}
