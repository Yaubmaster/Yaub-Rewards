'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Empresa } from '@/lib/types';

// Selector de empresa activa (oficina multi-empresa) + agregar otra
export function EmpresaSelector({ empresas, activaId }: { empresas: Empresa[]; activaId: string }) {
  const router = useRouter();

  const cambiar = async (id: string) => {
    await fetch('/rewards/empresa/activa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {empresas.length > 1 && (
        <select
          value={activaId}
          onChange={(e) => cambiar(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink outline-none"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
              {e.estado === 'en_revision' ? ' (en revisión)' : ''}
            </option>
          ))}
        </select>
      )}
      <Link
        href="/registro/empresa?nueva=1"
        className="rounded-xl border border-dashed border-[#CBD5E1] bg-surface px-3 py-2 text-[13px] font-semibold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
      >
        + Agregar empresa
      </Link>
    </div>
  );
}
