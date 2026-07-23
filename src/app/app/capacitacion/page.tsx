import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { CapacitacionClient, type Curso } from './CapacitacionClient';

export const dynamic = 'force-dynamic';

export default async function Capacitacion() {
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

  const { data: suscripciones } = await supabase
    .from('suscripciones')
    .select('empresa_id, capacitacion_completada, empresas(nombre, ofertas(producto, capacitacion, activa))')
    .eq('freelancer_id', freelancer.id);

  const cursos: Curso[] = (suscripciones ?? []).flatMap((s: any) => {
    const oferta = (s.empresas?.ofertas ?? []).find((o: any) => o.activa && o.capacitacion !== 'ninguna');
    if (!oferta) return [];
    return [
      {
        empresaId: s.empresa_id,
        empresa: s.empresas?.nombre ?? '',
        titulo: `Cómo vender ${oferta.producto}`,
        modo: oferta.capacitacion,
        completada: s.capacitacion_completada,
      },
    ];
  });

  return <CapacitacionClient cursos={cursos} freelancerId={freelancer.id} />;
}
