import { supabaseServer } from '@/lib/supabase/server';
import type { Empresa, Pago, Referido } from '@/lib/types';
import { AdminClient, type FreelancerResumen, type ReferidoAdmin } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const supabase = supabaseServer();

  const [{ data: empresas }, { data: referidos }, { data: freelancers }, { data: pagos }] =
    await Promise.all([
      supabase.from('empresas').select('*').order('created_at', { ascending: false }),
      supabase
        .from('referidos')
        .select('*, freelancers(nombre, codigo), ofertas(producto, empresas(nombre))')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('freelancers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('pagos')
        .select('*, freelancers(nombre, codigo)')
        .order('created_at', { ascending: false }),
    ]);

  const porLiberar = new Map<string, number>();
  ((referidos ?? []) as unknown as Referido[]).forEach((r) => {
    if (r.estatus === 'liberado') {
      porLiberar.set(r.freelancer_id, (porLiberar.get(r.freelancer_id) ?? 0) + Number(r.monto_mxn));
    }
  });

  const resumen: FreelancerResumen[] = (freelancers ?? []).map((f: any) => ({
    id: f.id,
    nombre: f.nombre,
    codigo: f.codigo,
    clabe: f.clabe,
    activo: f.activo,
    porPagar: porLiberar.get(f.id) ?? 0,
  }));

  return (
    <AdminClient
      empresas={(empresas ?? []) as Empresa[]}
      referidos={(referidos ?? []) as unknown as ReferidoAdmin[]}
      freelancers={resumen}
      pagos={(pagos ?? []) as unknown as (Pago & { freelancers: { nombre: string; codigo: string } | null })[]}
    />
  );
}
