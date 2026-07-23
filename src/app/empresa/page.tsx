import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { DashboardClient, type ReferidoEmpresa, type TopVendedor } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function EmpresaDashboard() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!empresa) redirect('/registro/finalizar');

  const { data: ofertas } = await supabase
    .from('ofertas')
    .select('id')
    .eq('empresa_id', empresa.id);
  const ofertaIds = (ofertas ?? []).map((o) => o.id);

  const [{ data: referidos }, { count: nSuscritos }] = await Promise.all([
    ofertaIds.length
      ? supabase
          .from('referidos')
          .select('*, freelancers(nombre, codigo)')
          .in('oferta_id', ofertaIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('suscripciones')
      .select('freelancer_id', { count: 'exact', head: true })
      .eq('empresa_id', empresa.id),
  ]);

  const lista = (referidos ?? []) as unknown as ReferidoEmpresa[];

  const porVendedor = new Map<string, TopVendedor>();
  lista.forEach((r) => {
    const key = r.codigo;
    const cur = porVendedor.get(key) ?? {
      nombre: r.freelancers?.nombre ?? key,
      codigo: key,
      ventas: 0,
    };
    cur.ventas += 1;
    porVendedor.set(key, cur);
  });
  const top = Array.from(porVendedor.values())
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 5);

  return (
    <DashboardClient
      empresaNombre={empresa.nombre}
      ofertaIds={ofertaIds}
      referidosIniciales={lista}
      topVendedores={top}
      nSuscritos={nSuscritos ?? 0}
    />
  );
}
