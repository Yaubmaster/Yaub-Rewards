import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { empresaActiva } from '@/lib/empresa';
import { iniciales } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FreelancersSuscritos() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { empresa } = await empresaActiva(supabase, user.id);
  if (!empresa) redirect('/registro/finalizar');

  const [{ data: suscripciones }, { data: ofertas }] = await Promise.all([
    supabase
      .from('suscripciones')
      .select('capacitacion_completada, freelancers(id, nombre, codigo)')
      .eq('empresa_id', empresa.id),
    supabase.from('ofertas').select('id, capacitacion').eq('empresa_id', empresa.id),
  ]);

  const ofertaIds = (ofertas ?? []).map((o) => o.id);
  const requiereCap = (ofertas ?? []).some((o) => o.capacitacion !== 'ninguna');

  const { data: referidos } = ofertaIds.length
    ? await supabase.from('referidos').select('freelancer_id').in('oferta_id', ofertaIds)
    : { data: [] as { freelancer_id: string }[] };

  const conteo = new Map<string, number>();
  (referidos ?? []).forEach((r) =>
    conteo.set(r.freelancer_id, (conteo.get(r.freelancer_id) ?? 0) + 1),
  );

  const filas = (suscripciones ?? [])
    .map((s: any) => ({
      id: s.freelancers?.id as string,
      nombre: (s.freelancers?.nombre as string) ?? '—',
      codigo: (s.freelancers?.codigo as string) ?? '—',
      refs: conteo.get(s.freelancers?.id) ?? 0,
      cap: !requiereCap ? null : s.capacitacion_completada ? 'Certificado' : 'En curso',
    }))
    .sort((a, b) => b.refs - a.refs);

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[26px] font-extrabold tracking-tight">Freelancers</h1>
        <div className="text-[13px] text-slate3">
          {filas.length} {filas.length === 1 ? 'suscrito' : 'suscritos'} a tu oferta
        </div>
      </div>

      <div className="mt-[18px] flex flex-col gap-2.5">
        {filas.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-[15px] transition-shadow hover:shadow-[0_6px_18px_rgba(10,10,15,.06)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-badge text-sm font-bold text-white">
              {iniciales(f.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{f.nombre}</div>
              <div className="mt-px font-mono text-xs text-slate3">{f.codigo}</div>
            </div>
            <div className="shrink-0 px-1.5 text-center">
              <div className="text-[17px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {f.refs}
              </div>
              <div className="text-[11px] text-slate3">referidos</div>
            </div>
            {f.cap && (
              <div
                className="shrink-0 rounded-full px-[11px] py-1 text-[11px] font-semibold"
                style={
                  f.cap === 'Certificado'
                    ? { background: 'rgba(16,185,129,.1)', color: '#10B981' }
                    : { background: 'rgba(245,158,11,.12)', color: '#F59E0B' }
                }
              >
                {f.cap}
              </div>
            )}
          </div>
        ))}
      </div>

      {filas.length === 0 && (
        <div className="mt-[18px] rounded-[20px] border border-dashed border-line bg-surface p-10 text-center">
          <div className="text-3xl">🧑‍💼</div>
          <div className="mt-2 text-sm font-semibold">Aún no hay freelancers suscritos</div>
          <div className="mt-1 text-[13px] text-slate2">
            Cuando tu empresa esté autorizada, los freelancers podrán suscribirse desde el
            marketplace.
          </div>
        </div>
      )}
    </div>
  );
}
