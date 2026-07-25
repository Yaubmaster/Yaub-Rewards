import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { NuevoAgenteClient } from './NuevoAgenteClient';

export const dynamic = 'force-dynamic';

export default async function NuevoAgentePage({
  searchParams,
}: {
  searchParams?: { empresa?: string };
}) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { empresa, empresas } = await empresaActiva(supabase, user.id);
  // ?empresa= permite crear el agente de cualquiera de sus empresas, no solo la activa
  const elegida = empresas.find((e) => e.id === searchParams?.empresa) ?? empresa;
  if (!elegida) redirect('/registro/finalizar');

  return <NuevoAgenteClient empresaId={elegida.id} empresaNombre={elegida.nombre} />;
}
