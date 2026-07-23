import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { EmpresasClient, type EmpresaMarketplace } from './EmpresasClient';

export const dynamic = 'force-dynamic';

export default async function Empresas() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: freelancer } = await supabase
    .from('freelancers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!freelancer) redirect('/registro/finalizar');

  const [{ data: empresas }, { data: suscripciones }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, nombre, descripcion, ofertas(id, producto, comision_mxn, condicion_liberacion, capacitacion, activa)')
      .eq('estado', 'autorizada')
      .order('created_at'),
    supabase.from('suscripciones').select('empresa_id').eq('freelancer_id', freelancer.id),
  ]);

  return (
    <EmpresasClient
      empresas={(empresas ?? []) as unknown as EmpresaMarketplace[]}
      suscritas={(suscripciones ?? []).map((s) => s.empresa_id)}
      freelancerId={freelancer.id}
    />
  );
}
