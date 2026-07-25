'use client';

// Quick Create hiper sencillo: nombre + prompt → agente listo para chatear.
// Trial gratis de 7 días; el contexto opcional se agrega en la pantalla del agente.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { agentesApi } from '@/lib/agentesApi';

export function NuevoAgenteClient({
  empresaId,
  empresaNombre,
}: {
  empresaId: string;
  empresaNombre: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [prompt, setPrompt] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setError(null);
    setCreando(true);
    try {
      const out = await agentesApi<{ agente: { id: string } }>({
        action: 'quick_create',
        empresa_id: empresaId,
        nombre,
        prompt,
      });
      router.push(`/empresa/agentes/${out.agente.id}`);
      router.refresh();
    } catch (e) {
      setCreando(false);
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-[560px] animate-fadeUpFast">
      <div className="text-[13px] font-semibold text-slate3">AGENTES YAUB · NUEVO</div>
      <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Crea tu agente</h1>
      <p className="mt-1.5 text-sm text-slate2">
        Gratis 7 días. Solo dos cosas y queda listo para probarlo en el chat.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <input
          className="input-yaub input-yaub--violet"
          placeholder={`Nombre del agente (ej. Asistente de ${empresaNombre})`}
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
        />
        <textarea
          className="input-yaub input-yaub--violet min-h-[150px] resize-y leading-relaxed"
          placeholder={`Eres el asistente de ventas de ${empresaNombre || '[mi negocio]'}, respondes dudas de los clientes y levantas pedidos. Hablas en español, cálido y directo…`}
          value={prompt}
          maxLength={4000}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-[13px] font-medium text-red-500">{error}</p>}

      <button
        onClick={crear}
        disabled={creando || !nombre.trim() || !prompt.trim()}
        className="btn-gradient mt-6 w-full py-[15px] text-base disabled:opacity-60"
      >
        {creando ? 'Creando tu agente…' : 'Crear agente'}
      </button>

      <p className="mt-3 text-center text-xs text-slate3">
        Después podrás agregarle tu sitio web, documentos e imágenes — o abrirlo en
        platform.yaub.ai para configuración avanzada.
      </p>
    </div>
  );
}
