'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { CapacitacionTipo, Oferta } from '@/lib/types';

interface OfertaForm {
  id: string | null; // null = nueva, aún sin guardar
  producto: string;
  comision: string;
  condicion: string;
  capacitacion: CapacitacionTipo;
  activa: boolean;
}

const desdeDb = (o: Oferta): OfertaForm => ({
  id: o.id,
  producto: o.producto,
  comision: String(Math.round(Number(o.comision_mxn))),
  condicion: o.condicion_liberacion ?? '',
  capacitacion: o.capacitacion,
  activa: o.activa,
});

export function OfertaClient({
  empresaId,
  ofertasIniciales,
}: {
  empresaId: string;
  ofertasIniciales: Oferta[];
}) {
  const [ofertas, setOfertas] = useState<OfertaForm[]>(
    ofertasIniciales.length
      ? ofertasIniciales.map(desdeDb)
      : [{ id: null, producto: '', comision: '', condicion: '', capacitacion: 'en_linea', activa: true }],
  );
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (i: number, campo: Partial<OfertaForm>) =>
    setOfertas((prev) => prev.map((o, j) => (j === i ? { ...o, ...campo } : o)));

  const eliminar = async (i: number) => {
    const o = ofertas[i];
    if (o.id) {
      const { error: err } = await supabaseBrowser().from('ofertas').delete().eq('id', o.id);
      if (err) {
        setError('No se pudo eliminar (puede tener referidos registrados). Desactívala en su lugar.');
        return;
      }
    }
    setOfertas((prev) => prev.filter((_, j) => j !== i));
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    const supabase = supabaseBrowser();
    for (const o of ofertas) {
      if (!o.producto.trim()) continue;
      const fila = {
        empresa_id: empresaId,
        producto: o.producto.trim(),
        comision_mxn: parseFloat(o.comision.replace(/[^\d.]/g, '')) || 0,
        condicion_liberacion: o.condicion.trim() || null,
        capacitacion: o.capacitacion,
        activa: o.activa,
      };
      if (o.id) {
        const { error: err } = await supabase.from('ofertas').update(fila).eq('id', o.id);
        if (err) {
          setError('No se pudieron guardar los cambios.');
          setGuardando(false);
          return;
        }
      } else {
        const { data, error: err } = await supabase.from('ofertas').insert(fila).select('id').single();
        if (err) {
          setError('No se pudo crear el servicio.');
          setGuardando(false);
          return;
        }
        o.id = data.id;
      }
    }
    setOfertas((prev) => [...prev]);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1600);
  };

  const chipCap = (i: number, o: OfertaForm, tipo: CapacitacionTipo, label: string) => (
    <button
      key={tipo}
      onClick={() => upd(i, { capacitacion: tipo })}
      className="rounded-full border px-4 py-[9px] text-[13px] font-semibold transition-all"
      style={
        o.capacitacion === tipo
          ? { background: '#0A0A0F', color: '#fff', borderColor: '#0A0A0F' }
          : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[26px] font-extrabold tracking-tight">Mi oferta</h1>
      <p className="mt-0.5 text-sm text-slate2">
        Esto es lo que los freelancers ven en el marketplace.
      </p>

      <div className="mt-5 flex max-w-[640px] flex-col gap-3.5">
        {ofertas.map((o, i) => (
          <div key={o.id ?? `nueva-${i}`} className="card animate-floatIn p-6">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-xs font-bold tracking-[0.08em] text-slate3">SERVICIO {i + 1}</div>
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate2">
                  <input
                    type="checkbox"
                    checked={o.activa}
                    onChange={(e) => upd(i, { activa: e.target.checked })}
                    className="accent-[#8B5CF6]"
                  />
                  Activa
                </label>
                {ofertas.length > 1 && (
                  <button
                    onClick={() => eliminar(i)}
                    className="text-xs font-semibold text-red-500 hover:underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate3">¿QUÉ NECESITAN VENDER?</div>
                <input
                  className="input-yaub"
                  placeholder="Ej. Portabilidad Yaub Móvil"
                  value={o.producto}
                  onChange={(e) => upd(i, { producto: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate3">COMISIÓN (MXN)</div>
                  <input
                    className="input-yaub"
                    placeholder="Ej. 100"
                    value={o.comision}
                    onChange={(e) => upd(i, { comision: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate3">CONDICIÓN DE LIBERACIÓN</div>
                  <input
                    className="input-yaub"
                    placeholder="Ej. primera_recarga"
                    value={o.condicion}
                    onChange={(e) => upd(i, { condicion: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate3">CAPACITACIÓN QUE OFRECEN</div>
                <div className="flex flex-wrap gap-2">
                  {chipCap(i, o, 'en_linea', 'En línea')}
                  {chipCap(i, o, 'presencial', 'Presencial')}
                  {chipCap(i, o, 'ninguna', 'Ninguna')}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() =>
            setOfertas((prev) => [
              ...prev,
              { id: null, producto: '', comision: '', condicion: '', capacitacion: 'en_linea', activa: true },
            ])
          }
          className="rounded-2xl border-[1.5px] border-dashed border-[#CBD5E1] bg-surface p-4 text-center text-sm font-semibold text-slate2 transition-all hover:border-cyan1 hover:text-[#0EA5E9]"
        >
          + Agregar servicio
        </button>

        {error && <p className="text-[13px] font-medium text-red-500">{error}</p>}

        <button
          onClick={guardar}
          disabled={guardando}
          className="btn-gradient self-start px-[26px] py-3 text-sm disabled:opacity-60"
        >
          {guardado ? '✓ Publicado' : guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
