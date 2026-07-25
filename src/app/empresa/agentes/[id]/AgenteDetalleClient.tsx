'use client';

// Detalle de un agente Yaub: chat de prueba (widget-chat de la plataforma),
// countdown del trial, y contexto opcional en secciones colapsables
// (sitios web / documentos / imágenes con instrucción). La configuración
// avanzada NO vive aquí: botón "Abrir en Yaub" → platform.yaub.ai.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon, ICON_PATHS } from '@/components/icons';
import {
  agentesApi,
  diasRestantes,
  estadoAgente,
  type AgenteResumen,
  type ContextoConocimiento,
  type ContextoImagen,
} from '@/lib/agentesApi';

const PLATAFORMA_URL = 'https://platform.yaub.ai';

// ── Chat de prueba (usa la edge function pública widget-chat) ────────────────
function visitorId(): string {
  const KEY = 'rewards_visitor_id';
  let v = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (!v) {
    v = 'rw' + Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36])
      .join('');
    localStorage.setItem(KEY, v);
  }
  return v;
}

async function widgetChat(payload: Record<string, unknown>) {
  const host = window.location.hostname;
  const body: Record<string, unknown> = { ...payload, visitor_id: visitorId() };
  // En dominios yaub.ai mandamos parent_domain (validado contra allowed_domains);
  // en localhost el Origin ya cuenta como first-party para widget-chat.
  if (host.endsWith('yaub.ai')) body.parent_domain = host;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/widget-chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const out = await res.json().catch(() => null);
  if (!res.ok) throw new Error(out?.error ?? 'El chat no respondió');
  return out;
}

interface Mensaje {
  role: 'user' | 'assistant';
  text: string;
}

function ChatPrueba({ widgetKey, pausado }: { widgetKey: string; pausado: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fondoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    widgetChat({ action: 'init', key: widgetKey })
      .then((out) => {
        const hist = (out.history ?? []) as { role: string; text: string }[];
        setMensajes(hist.map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', text: h.text })));
      })
      .catch(() => {});
  }, [widgetKey]);

  useEffect(() => {
    fondoRef.current?.scrollTo({ top: fondoRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, pensando]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || pensando) return;
    setError(null);
    setTexto('');
    setMensajes((m) => [...m, { role: 'user', text: t }]);
    setPensando(true);
    try {
      const out = await widgetChat({ action: 'message', key: widgetKey, text: t });
      setMensajes((m) => [...m, { role: 'assistant', text: out.reply ?? '…' }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPensando(false);
    }
  };

  // Renderiza URLs de imagen como imagen (así se prueban las "imágenes con instrucción")
  const renderTexto = (t: string) => {
    const partes = t.split(/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)\S*)/gi);
    return partes.map((p, i) =>
      /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(p) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={p} alt="" className="my-1.5 max-h-48 max-w-full rounded-xl" />
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={`h-2 w-2 rounded-full ${pausado ? 'bg-amber1' : 'animate-pulseDot bg-green1'}`} />
        <span className="text-[13px] font-bold">Prueba tu agente</span>
        <span className="ml-auto text-[11px] text-slate3">chat web en vivo</span>
      </div>

      <div ref={fondoRef} className="flex h-[340px] flex-col gap-2.5 overflow-y-auto bg-surface/60 px-4 py-4">
        {mensajes.length === 0 && !pensando && (
          <p className="m-auto max-w-[260px] text-center text-[13px] text-slate3">
            Escríbele como si fueras un cliente: &quot;¿qué venden?&quot;, &quot;¿cuánto
            cuesta?&quot;…
          </p>
        )}
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed animate-fadeUpFast ${
              m.role === 'user'
                ? 'self-end bg-ink text-white'
                : 'self-start border border-line bg-white'
            }`}
          >
            {renderTexto(m.text)}
          </div>
        ))}
        {pensando && (
          <div className="flex items-center gap-1.5 self-start rounded-2xl border border-line bg-white px-3.5 py-3">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate3" />
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate3" style={{ animationDelay: '.15s' }} />
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate3" style={{ animationDelay: '.3s' }} />
          </div>
        )}
      </div>

      {error && <p className="px-4 pt-2 text-[12px] font-medium text-red-500">{error}</p>}

      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          className="input-yaub flex-1 !py-3"
          placeholder={pausado ? 'El agente está pausado' : 'Escribe un mensaje…'}
          value={texto}
          disabled={pausado}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
        />
        <button
          onClick={enviar}
          disabled={pausado || pensando || !texto.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-badge transition-transform active:scale-95 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Icon d={ICON_PATHS.send} size={18} stroke="#fff" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function Seccion({
  icono,
  titulo,
  descripcion,
  children,
}: {
  icono: keyof typeof ICON_PATHS;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <details className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
          <Icon d={ICON_PATHS[icono]} size={18} stroke="#0A0A0F" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{titulo}</div>
          <div className="text-xs text-slate3">{descripcion}</div>
        </div>
        <span className="text-slate3 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

// ── Pantalla completa ─────────────────────────────────────────────────────────
export function AgenteDetalleClient({
  empresaId,
  assistantId,
}: {
  empresaId: string;
  assistantId: string;
}) {
  const [agente, setAgente] = useState<AgenteResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPagina, setErrorPagina] = useState<string | null>(null);

  const [conocimiento, setConocimiento] = useState<ContextoConocimiento[]>([]);
  const [imagenes, setImagenes] = useState<ContextoImagen[]>([]);

  const [urlSitio, setUrlSitio] = useState('');
  const [imgNombre, setImgNombre] = useState('');
  const [imgInstruccion, setImgInstruccion] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [lista, ctx] = await Promise.all([
        agentesApi<{ agentes: AgenteResumen[] }>({ action: 'list', empresa_id: empresaId }),
        agentesApi<{ conocimiento: ContextoConocimiento[]; imagenes: ContextoImagen[] }>({
          action: 'list_context',
          empresa_id: empresaId,
          assistant_id: assistantId,
        }),
      ]);
      const a = lista.agentes.find((x) => x.id === assistantId);
      if (!a) throw new Error('Ese agente no es de tu empresa');
      setAgente(a);
      setConocimiento(ctx.conocimiento);
      setImagenes(ctx.imagenes);
    } catch (e) {
      setErrorPagina((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [empresaId, assistantId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const flash = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2200);
  };

  const agregarSitio = async () => {
    setOcupado('sitio');
    try {
      await agentesApi({ action: 'add_website', empresa_id: empresaId, assistant_id: assistantId, url: urlSitio });
      setUrlSitio('');
      flash('Sitio agregado: tu agente ya lo usa de contexto');
      await cargar();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const subirArchivo = async (file: File, tipo: 'doc' | 'imagen') => {
    const supabase = supabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión expirada');
    const limpio = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${assistantId}/${Date.now()}-${limpio}`;
    const { error } = await supabase.storage.from('rewards-agentes').upload(path, file);
    if (error) throw new Error('No se pudo subir el archivo');
    return path;
  };

  const agregarDocumento = async (file: File | null) => {
    if (!file) return;
    setOcupado('doc');
    try {
      const path = await subirArchivo(file, 'doc');
      const out = await agentesApi<{ texto_extraido: boolean }>({
        action: 'add_document',
        empresa_id: empresaId,
        assistant_id: assistantId,
        path,
        titulo: file.name,
      });
      flash(
        out.texto_extraido
          ? 'Documento agregado: tu agente ya conoce su contenido'
          : 'Documento guardado (no pudimos extraer texto, quedó como referencia)',
      );
      await cargar();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const agregarImagen = async (file: File | null) => {
    if (!file) return;
    if (!imgInstruccion.trim()) {
      flash('Primero dinos cuándo debe compartir la imagen');
      return;
    }
    setOcupado('imagen');
    try {
      const path = await subirArchivo(file, 'imagen');
      await agentesApi({
        action: 'add_image',
        empresa_id: empresaId,
        assistant_id: assistantId,
        path,
        nombre: imgNombre || file.name.replace(/\.[^.]+$/, ''),
        instruccion: imgInstruccion,
      });
      setImgNombre('');
      setImgInstruccion('');
      flash('Imagen agregada: el agente la compartirá cuando aplique');
      await cargar();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (tipo: 'conocimiento' | 'imagen', id: string) => {
    try {
      await agentesApi({ action: 'delete_context', empresa_id: empresaId, assistant_id: assistantId, tipo, id });
      await cargar();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <div className="shimmer h-8 w-2/5 rounded-lg" />
        <div className="shimmer h-[380px] rounded-[20px]" />
      </div>
    );
  }
  if (errorPagina || !agente) {
    return (
      <div className="card p-6 text-center">
        <div className="text-lg font-bold">No encontramos ese agente</div>
        <p className="mt-1 text-sm text-slate2">{errorPagina}</p>
        <Link href="/empresa/agentes" className="btn-gradient mt-4 inline-block px-5 py-2.5 text-sm">
          Volver a mis agentes
        </Link>
      </div>
    );
  }

  const estado = estadoAgente(agente);
  const dias = diasRestantes(agente.trial);
  const pausado = estado === 'pausado';

  return (
    <div className="animate-fadeUpFast">
      <Link href="/empresa/agentes" className="text-[13px] font-semibold text-slate3 hover:text-ink">
        ← Agentes Yaub Conectados
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-badge">
            <Icon d={ICON_PATHS.bot} size={22} stroke="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight">{agente.name}</h1>
            <div className="text-xs text-slate3">Modelo recomendado de Yaub · chat web</div>
          </div>
        </div>
        <a
          href={`${PLATAFORMA_URL}/assistants/${agente.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-bold text-slate2 transition-colors hover:border-violet1 hover:text-violet1"
        >
          <Icon d={ICON_PATHS.external} size={15} />
          Abrir en Yaub
        </a>
      </div>

      {/* Estado del trial */}
      {estado === 'prueba' && agente.trial && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-[rgba(0,212,255,.35)] bg-[rgba(0,212,255,.07)] px-4 py-3 text-[13px] font-medium text-[#0369A1]">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan1" />
          {dias === 1 ? 'Te queda 1 día de prueba gratis.' : `Te quedan ${dias} días de prueba gratis.`}
          <span className="text-[#0369A1]/70">Al terminar, el agente se pausa (no se borra).</span>
        </div>
      )}
      {pausado && (
        <div className="mt-4 rounded-2xl border border-[rgba(245,158,11,.4)] bg-[rgba(245,158,11,.08)] px-4 py-3.5">
          <div className="text-[13px] font-bold text-[#B45309]">
            Tu prueba gratis terminó y el agente está pausado.
          </div>
          <p className="mt-0.5 text-[13px] text-[#B45309]/80">
            Nada se borró: su prompt y contexto siguen intactos. Actívalo con Yaub para que vuelva
            a responder.
          </p>
          <a
            href={`${PLATAFORMA_URL}/assistants/${agente.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-gradient mt-2.5 inline-block px-4 py-2.5 text-[13px]"
          >
            Activar con Yaub
          </a>
        </div>
      )}

      {aviso && (
        <div className="mt-4 animate-pop rounded-2xl border border-[rgba(16,185,129,.35)] bg-[rgba(16,185,129,.08)] px-4 py-3 text-[13px] font-semibold text-[#047857]">
          {aviso}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Chat de prueba */}
        <div className="min-w-0">
          {agente.widget_public_key ? (
            <ChatPrueba widgetKey={agente.widget_public_key} pausado={pausado} />
          ) : (
            <div className="card p-6 text-center text-sm text-slate2">
              Este agente no tiene chat web habilitado. Ábrelo en Yaub para configurarlo.
            </div>
          )}
        </div>

        {/* Contexto opcional */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="text-[13px] font-bold text-slate2">
            Dale contexto a tu agente <span className="font-medium text-slate3">(opcional)</span>
          </div>

          <Seccion icono="globe" titulo="Sitios web" descripcion="Pega URLs y el agente las usa de contexto">
            <div className="flex flex-col gap-2">
              {conocimiento
                .filter((k) => k.content_type === 'website')
                .map((k) => (
                  <div key={k.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{k.title}</span>
                    <button onClick={() => borrar('conocimiento', k.id)} aria-label="Quitar">
                      <Icon d={ICON_PATHS.trash} size={15} stroke="#94A3B8" />
                    </button>
                  </div>
                ))}
              <div className="flex gap-2">
                <input
                  className="input-yaub flex-1 !py-2.5 text-[13px]"
                  placeholder="https://minegocio.com"
                  value={urlSitio}
                  onChange={(e) => setUrlSitio(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && urlSitio.trim() && agregarSitio()}
                />
                <button
                  onClick={agregarSitio}
                  disabled={ocupado === 'sitio' || !urlSitio.trim()}
                  className="rounded-xl bg-ink px-3.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {ocupado === 'sitio' ? '…' : 'Agregar'}
                </button>
              </div>
            </div>
          </Seccion>

          <Seccion icono="doc" titulo="Documentos" descripcion="PDF, TXT o MD con info de tu negocio">
            <div className="flex flex-col gap-2">
              {conocimiento
                .filter((k) => k.content_type === 'document')
                .map((k) => (
                  <div key={k.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                    <Icon d={ICON_PATHS.doc} size={14} stroke="#64748B" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{k.title}</span>
                    <button onClick={() => borrar('conocimiento', k.id)} aria-label="Quitar">
                      <Icon d={ICON_PATHS.trash} size={15} stroke="#94A3B8" />
                    </button>
                  </div>
                ))}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-3 text-[13px] font-semibold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0284C7]">
                <Icon d={ICON_PATHS.plus} size={15} />
                {ocupado === 'doc' ? 'Subiendo…' : 'Subir documento'}
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv"
                  className="hidden"
                  disabled={ocupado === 'doc'}
                  onChange={(e) => agregarDocumento(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </Seccion>

          <Seccion
            icono="image"
            titulo="Imágenes con instrucciones"
            descripcion="Menú, catálogo, promos — y cuándo compartirlas"
          >
            <div className="flex flex-col gap-2">
              {imagenes.map((img) => (
                <div key={img.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold">{img.name}</div>
                    <div className="truncate text-[11.5px] text-slate3">{img.description}</div>
                  </div>
                  <button onClick={() => borrar('imagen', img.id)} aria-label="Quitar">
                    <Icon d={ICON_PATHS.trash} size={15} stroke="#94A3B8" />
                  </button>
                </div>
              ))}
              <input
                className="input-yaub !py-2.5 text-[13px]"
                placeholder="Nombre (ej. Menú del día)"
                value={imgNombre}
                onChange={(e) => setImgNombre(e.target.value)}
              />
              <input
                className="input-yaub !py-2.5 text-[13px]"
                placeholder="¿Cuándo debe compartirla? (ej. cuando pregunten por el menú)"
                value={imgInstruccion}
                onChange={(e) => setImgInstruccion(e.target.value)}
              />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-3 text-[13px] font-semibold text-slate2 transition-colors hover:border-violet1 hover:text-violet1">
                <Icon d={ICON_PATHS.plus} size={15} />
                {ocupado === 'imagen' ? 'Subiendo…' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={ocupado === 'imagen'}
                  onChange={(e) => agregarImagen(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
