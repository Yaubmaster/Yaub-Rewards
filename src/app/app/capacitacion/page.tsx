import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { CapacitacionModulo } from '@/lib/types';
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

  const empresaIds = (suscripciones ?? []).map((s: any) => s.empresa_id);
  // RLS: los módulos solo son visibles para suscritos (o dueño/admin)
  const { data: modulos } = empresaIds.length
    ? await supabase
        .from('capacitacion_modulos')
        .select('*')
        .in('empresa_id', empresaIds)
        .order('orden')
        .order('created_at')
    : { data: [] as CapacitacionModulo[] };

  const porEmpresa = new Map<string, CapacitacionModulo[]>();
  ((modulos ?? []) as CapacitacionModulo[]).forEach((m) => {
    porEmpresa.set(m.empresa_id, [...(porEmpresa.get(m.empresa_id) ?? []), m]);
  });

  const cursos: Curso[] = (suscripciones ?? []).flatMap((s: any) => {
    const oferta = (s.empresas?.ofertas ?? []).find((o: any) => o.activa) ?? s.empresas?.ofertas?.[0];
    const mods = porEmpresa.get(s.empresa_id) ?? [];
    if (!mods.length && (!oferta || oferta.capacitacion === 'ninguna')) return [];
    return [
      {
        empresaId: s.empresa_id,
        empresa: s.empresas?.nombre ?? '',
        titulo: oferta ? `Cómo vender ${oferta.producto}` : `Capacitación ${s.empresas?.nombre ?? ''}`,
        modo: oferta?.capacitacion ?? 'en_linea',
        completada: s.capacitacion_completada,
        modulos: mods,
      },
    ];
  });

  return <CapacitacionClient cursos={cursos} freelancerId={freelancer.id} />;
}
