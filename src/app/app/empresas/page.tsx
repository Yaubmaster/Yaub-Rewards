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
      .select(
        'id, nombre, descripcion, ofertas(id, producto, descripcion, precio_mxn, fotos, comision_mxn, condicion_liberacion, capacitacion, activa)',
      )
      .eq('estado', 'autorizada')
      .order('created_at'),
    supabase.from('suscripciones').select('empresa_id').eq('freelancer_id', freelancer.id),
  ]);

  const lista = (empresas ?? []) as unknown as EmpresaMarketplace[];

  // Conteo de módulos de capacitación por empresa (RPC security definer)
  const conteos = await Promise.all(
    lista.map((e) =>
      supabase
        .rpc('contar_modulos', { p_empresa_id: e.id })
        .then(({ data }) => [e.id, (data as number) ?? 0] as const),
    ),
  );
  const modulosPorEmpresa = Object.fromEntries(conteos);

  return (
    <EmpresasClient
      empresas={lista}
      suscritas={(suscripciones ?? []).map((s) => s.empresa_id)}
      freelancerId={freelancer.id}
      modulosPorEmpresa={modulosPorEmpresa}
    />
  );
}
