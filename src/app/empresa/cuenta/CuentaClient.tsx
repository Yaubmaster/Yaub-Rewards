'use client';

// Ajustes de la cuenta: el logo del tenant de Yaub. Es lo que ven los
// vendedores como "Publicado por" en el marketplace, así que aquí se cambia sin
// tener que salir a platform.yaub.ai.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AvatarEditable } from '@/components/Avatar';
import { TemaToggle } from '@/components/TemaToggle';
import { guardarAvatarCuenta, misCuentas, type CuentaYaub } from '@/lib/agentesApi';

export function CuentaClient() {
  const [cuentas, setCuentas] = useState<CuentaYaub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCuentas(await misCuentas());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="animate-fadeUpFast">
      <h1 className="text-[22px] font-extrabold tracking-tight">Cuenta</h1>
      <p className="mt-0.5 text-[13px] text-slate2">
        El logo de tu cuenta de Yaub es lo que los vendedores ven como “Publicado por”.
      </p>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
          {error}
        </div>
      )}

      {!cuentas && !error && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="shimmer h-[120px] rounded-[20px]" />
        </div>
      )}

      {cuentas && cuentas.length === 0 && (
        <div className="card mt-5 px-5 py-8 text-center text-sm text-slate2">
          Todavía no administras ninguna cuenta de Yaub con agentes.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {(cuentas ?? []).map((c) => (
          <div key={c.tenant_id} className="card p-4 md:p-5">
            <div className="mb-3">
              <div className="text-[15px] font-bold">{c.nombre}</div>
              <div className="text-xs text-slate3">
                {c.agentes === 1 ? '1 agente' : `${c.agentes} agentes`}
              </div>
            </div>
            <AvatarEditable
              url={c.avatar_url}
              nombre={c.nombre}
              size={64}
              slug={`cuenta-${c.tenant_id}`}
              onGuardar={async (url) => {
                await guardarAvatarCuenta(c.tenant_id, url);
                await cargar();
              }}
            />
          </div>
        ))}
      </div>

      <div className="card mt-3.5 p-4 md:p-5">
        <div className="mb-1 text-[15px] font-bold">Foto de cada empresa</div>
        <div className="text-[13px] text-slate2">
          Cada empresa es un agente y tiene su propia foto. La cambias desde el agente.
        </div>
        <Link
          href="/empresa/agentes"
          className="mt-3 inline-block rounded-xl border border-line px-4 py-2 text-[12.5px] font-bold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
        >
          Ir a mis agentes
        </Link>
      </div>

      <div className="card mt-3.5 p-4 md:p-5">
        <div className="mb-1 text-[15px] font-bold">Apariencia</div>
        <div className="mb-1 text-[13px] text-slate2">
          Elige cómo se ve Yaub Rewards en este dispositivo.
        </div>
        <div className="-mx-3 mt-1">
          <TemaToggle variante="fila" />
        </div>
      </div>
    </div>
  );
}
