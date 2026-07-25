'use client';

// Editor del prompt del agente dentro de Rewards: un principiante no debería
// salir a platform.yaub.ai para esto.
//
// El bloque que Rewards inyecta con lo que extrae de sitios, documentos,
// imágenes y ofertas se muestra aparte y NO se edita a mano: se regenera solo
// cada vez que agregas contexto, y se re-adjunta al guardar.
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export function PromptAgente({ assistantId }: { assistantId: string }) {
  const [prompt, setPrompt] = useState('');
  const [original, setOriginal] = useState('');
  const [contexto, setContexto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.rpc('leer_prompt_agente', { p_assistant_id: assistantId });
    const r = (data ?? null) as { prompt_base?: string; contexto?: string | null } | null;
    setPrompt(r?.prompt_base ?? '');
    setOriginal(r?.prompt_base ?? '');
    setContexto(r?.contexto ?? null);
    setCargando(false);
  }, [assistantId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.rpc('guardar_prompt_agente', {
      p_assistant_id: assistantId,
      p_prompt: prompt,
    });
    setGuardando(false);
    setAviso(
      error
        ? error.message?.includes('permiso')
          ? 'Solo el dueño de la cuenta Yaub puede editar este agente.'
          : 'No se pudo guardar.'
        : 'Prompt guardado ✓',
    );
    if (!error) setOriginal(prompt);
    setTimeout(() => setAviso(null), 2600);
  };

  if (cargando) return <div className="shimmer h-[190px] rounded-[20px]" />;

  return (
    <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">Qué hace tu agente</div>
          <div className="text-xs text-slate3">
            Sus instrucciones. Escríbelas como se las dirías a un empleado nuevo.
          </div>
        </div>
        {prompt !== original && (
          <button
            onClick={guardar}
            disabled={guardando}
            className="btn-gradient px-4 py-2 text-[13px] disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>

      <textarea
        className="input-yaub mt-3 min-h-[170px] resize-y leading-relaxed"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Eres el asistente de ventas de mi negocio. Respondes dudas, cotizas y cierras. Al cerrar, pregunta siempre quién refirió al cliente y registra su código."
      />

      {aviso && <p className="mt-2 text-[12.5px] font-semibold text-green1">{aviso}</p>}

      {contexto && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-slate2">
            Contexto que Rewards le inyecta automáticamente
          </summary>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[11.5px] leading-relaxed text-slate2">
            {contexto.trim()}
          </pre>
          <p className="mt-1.5 text-[11.5px] text-slate3">
            Se regenera solo con tus sitios, documentos, imágenes y ofertas. No lo edites aquí.
          </p>
        </details>
      )}
    </div>
  );
}
