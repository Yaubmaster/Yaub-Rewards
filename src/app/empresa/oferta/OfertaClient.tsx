'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { youtubeId, youtubeThumb } from '@/lib/youtube';
import type { CapacitacionModulo, CapacitacionTipo, Oferta } from '@/lib/types';

interface OfertaForm {
  id: string | null; // null = nueva, aún sin guardar
  producto: string;
  descripcion: string;
  precio: string;
  comision: string;
  condicion: string;
  capacitacion: CapacitacionTipo;
  activa: boolean;
  fotos: string[];
}

const desdeDb = (o: Oferta): OfertaForm => ({
  id: o.id,
  producto: o.producto,
  descripcion: o.descripcion ?? '',
  precio: o.precio_mxn != null ? String(Math.round(Number(o.precio_mxn))) : '',
  comision: String(Math.round(Number(o.comision_mxn))),
  condicion: o.condicion_liberacion ?? '',
  capacitacion: o.capacitacion,
  activa: o.activa,
  fotos: Array.isArray(o.fotos) ? o.fotos : [],
});

const NUEVA: OfertaForm = {
  id: null,
  producto: '',
  descripcion: '',
  precio: '',
  comision: '',
  condicion: '',
  capacitacion: 'en_linea',
  activa: true,
  fotos: [],
};

export function OfertaClient({
  empresaId,
  ofertasIniciales,
  modulosIniciales,
}: {
  empresaId: string;
  ofertasIniciales: Oferta[];
  modulosIniciales: CapacitacionModulo[];
}) {
  const [ofertas, setOfertas] = useState<OfertaForm[]>(
    ofertasIniciales.length ? ofertasIniciales.map(desdeDb) : [{ ...NUEVA }],
  );
  const [modulos, setModulos] = useState<CapacitacionModulo[]>(modulosIniciales);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoLink, setNuevoLink] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [agregandoModulo, setAgregandoModulo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (i: number, campo: Partial<OfertaForm>) =>
    setOfertas((prev) => prev.map((o, j) => (j === i ? { ...o, ...campo } : o)));

  // ── Fotos (Supabase Storage, carpeta del usuario) ──────────────────────────

  const subirFoto = async (i: number, file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto debe pesar menos de 5 MB.');
      return;
    }
    setSubiendo(i);
    const supabase = supabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubiendo(null);
      return;
    }
    const ruta = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('rewards-fotos').upload(ruta, file);
    if (upErr) {
      setSubiendo(null);
      setError('No se pudo subir la foto. Intenta de nuevo.');
      return;
    }
    const { data } = supabase.storage.from('rewards-fotos').getPublicUrl(ruta);
    upd(i, { fotos: [...ofertas[i].fotos, data.publicUrl] });
    setSubiendo(null);
  };

  const quitarFoto = (i: number, url: string) =>
    upd(i, { fotos: ofertas[i].fotos.filter((f) => f !== url) });

  // ── Módulos de capacitación (YouTube) ──────────────────────────────────────

  const agregarModulo = async () => {
    setError(null);
    const vid = youtubeId(nuevoLink);
    if (!vid) {
      setError('El link debe ser de YouTube (youtube.com/watch, youtu.be o shorts).');
      return;
    }
    if (!nuevoTitulo.trim()) {
      setError('Ponle un título al módulo (ej. "Cómo presentar el producto").');
      return;
    }
    setAgregandoModulo(true);
    const { data, error: err } = await supabaseBrowser()
      .from('capacitacion_modulos')
      .insert({
        empresa_id: empresaId,
        titulo: nuevoTitulo.trim(),
        youtube_url: nuevoLink.trim(),
        orden: modulos.length + 1,
      })
      .select('*')
      .single();
    setAgregandoModulo(false);
    if (err || !data) {
      setError('No se pudo agregar el módulo.');
      return;
    }
    setModulos((prev) => [...prev, data as CapacitacionModulo]);
    setNuevoTitulo('');
    setNuevoLink('');
  };

  const quitarModulo = async (id: string) => {
    const { error: err } = await supabaseBrowser()
      .from('capacitacion_modulos')
      .delete()
      .eq('id', id);
    if (!err) setModulos((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Guardar ofertas ────────────────────────────────────────────────────────

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
        descripcion: o.descripcion.trim() || null,
        precio_mxn: o.precio ? parseFloat(o.precio.replace(/[^\d.]/g, '')) || null : null,
        comision_mxn: parseFloat(o.comision.replace(/[^\d.]/g, '')) || 0,
        condicion_liberacion: o.condicion.trim() || null,
        capacitacion: o.capacitacion,
        activa: o.activa,
        fotos: o.fotos,
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
        Esto es lo que los freelancers ven en el marketplace. Entre más completa, más vendedores
        se suscriben.
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

              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate3">DESCRIPCIÓN DEL PRODUCTO</div>
                <textarea
                  className="input-yaub min-h-[88px] resize-y"
                  placeholder="Explica qué es, para quién es y por qué conviene. Esto es lo que convence al freelancer de venderlo."
                  value={o.descripcion}
                  onChange={(e) => upd(i, { descripcion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate3">PRECIO AL CLIENTE (MXN)</div>
                  <input
                    className="input-yaub"
                    placeholder="Ej. 200"
                    value={o.precio}
                    onChange={(e) => upd(i, { precio: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate3">COMISIÓN AL VENDEDOR (MXN)</div>
                  <input
                    className="input-yaub"
                    placeholder="Ej. 100"
                    value={o.comision}
                    onChange={(e) => upd(i, { comision: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
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

              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate3">FOTOS DEL PRODUCTO</div>
                <div className="flex flex-wrap gap-2.5">
                  {o.fotos.map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Foto del producto"
                        className="h-20 w-20 rounded-xl border border-line object-cover"
                      />
                      <button
                        onClick={() => quitarFoto(i, url)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white"
                        aria-label="Quitar foto"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#CBD5E1] bg-surface text-[11px] font-semibold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9]">
                    {subiendo === i ? '…' : '+ Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={subiendo !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) subirFoto(i, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
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
          onClick={() => setOfertas((prev) => [...prev, { ...NUEVA }])}
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

        {/* ── Módulos de capacitación en video ── */}
        <div className="card mt-2 p-6">
          <div className="text-xs font-bold tracking-[0.08em] text-slate3">
            CAPACITACIÓN EN VIDEO · MÓDULOS
          </div>
          <p className="mt-1.5 text-[13px] text-slate2">
            El estándar Yaub Rewards: graba módulos cortos explicando cómo vender tu producto,
            súbelos a YouTube (pueden ser ocultos/no listados) y pega el link. Los freelancers los
            ven al suscribirse y al completarlos quedan como <b>vendedores certificados</b> de tu
            producto.
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            {modulos.map((m, idx) => {
              const vid = youtubeId(m.youtube_url);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5"
                >
                  {vid ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={youtubeThumb(vid)}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-surface text-lg">
                      🎬
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      Módulo {idx + 1}: {m.titulo}
                    </div>
                    <div className="truncate text-xs text-slate3">{m.youtube_url}</div>
                  </div>
                  <button
                    onClick={() => quitarModulo(m.id)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
            {modulos.length === 0 && (
              <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-center text-[13px] text-slate2">
                Aún no tienes módulos. Te recomendamos al menos 2: qué es el producto y cómo
                cerrarlo.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <input
              className="input-yaub"
              placeholder="Título del módulo (ej. Cómo presentar Yaub Móvil)"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
            />
            <input
              className="input-yaub"
              placeholder="Link de YouTube (ej. https://youtu.be/…)"
              value={nuevoLink}
              onChange={(e) => setNuevoLink(e.target.value)}
            />
            <button
              onClick={agregarModulo}
              disabled={agregandoModulo}
              className="self-start rounded-xl bg-ink px-5 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-px disabled:opacity-60"
            >
              {agregandoModulo ? 'Agregando…' : '+ Agregar módulo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
