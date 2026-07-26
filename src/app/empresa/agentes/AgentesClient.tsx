'use client';

// Panel empresarial: cada AGENTE de tus cuentas de Yaub es una empresa de
// Rewards. Aquí ves todos tus agentes de la plataforma y activas los que
// quieres que vendan con la red de vendedores.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar } from '@/components/Avatar';
import { Icon, ICON_PATHS } from '@/components/icons';
import { INTERACCIONES_TRIAL, PLAN_MENSUAL, type AgenteDeCuenta } from '@/lib/agentesApi';
import { urlPlayground } from '@/lib/plataforma';

function Estado({ a }: { a: AgenteDeCuenta }) {
  const restantes = Math.max(0, a.interacciones_incluidas - a.interacciones_usadas);
  let txt: string, bg: string, fg: string;
  if (!a.rewards_activo) {
    txt = 'Sin Rewards';
    bg = 'rgba(148,163,184,.16)';
    fg = '#64748B';
  } else if (a.con_plan) {
    txt = 'Con plan';
    bg = 'rgba(16,185,129,.12)';
    fg = '#059669';
  } else if (restantes === 0) {
    txt = 'Prueba agotada';
    bg = 'rgba(245,158,11,.14)';
    fg = '#B45309';
  } else {
    txt = `${restantes} gratis`;
    bg = 'rgba(0,212,255,.12)';
    fg = '#0284C7';
  }
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: bg, color: fg }}
    >
      {txt}
    </span>
  );
}

export function AgentesClient() {
  const [agentes, setAgentes] = useState<AgenteDeCuenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activando, setActivando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data, error: e } = await supabase.rpc('mis_agentes');
    if (e) {
      setError('No pudimos cargar tus agentes. Intenta de nuevo.');
      return;
    }
    setAgentes((data ?? []) as unknown as AgenteDeCuenta[]);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const activar = async (assistantId: string) => {
    setActivando(assistantId);
    const supabase = supabaseBrowser();
    const { error: e } = await supabase.rpc('activar_rewards_en_agente', {
      p_assistant_id: assistantId,
    });
    setActivando(null);
    if (e) {
      // La RLS de la plataforma solo deja editar agentes a dueños de la cuenta
      setError(
        e.message?.includes('permiso')
          ? 'Solo el dueño de la cuenta Yaub puede activar Rewards en este agente.'
          : 'No se pudo activar ese agente.',
      );
      return;
    }
    await cargar();
  };

  const activados = (agentes ?? []).filter((a) => a.rewards_activo);
  const disponibles = (agentes ?? []).filter((a) => !a.rewards_activo);

  return (
    <div className="animate-fadeUpFast">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Agentes Yaub Conectados</h1>
          <p className="mt-0.5 text-[13px] text-slate2">
            Cada agente de tu cuenta es una empresa aquí: los vendedores se suscriben al agente.
            Actívale Rewards al que quieras que venda — {INTERACCIONES_TRIAL} interacciones gratis
            y luego {PLAN_MENSUAL}.
          </p>
        </div>
        <Link href="/empresa/agentes/nuevo" className="btn-gradient px-4 py-2.5 text-sm">
          Crear empresa/agente
        </Link>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
          {error}
        </div>
      )}

      {!agentes && !error && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="shimmer h-[88px] rounded-[20px]" />
          <div className="shimmer h-[88px] rounded-[20px]" />
        </div>
      )}

      {agentes && agentes.length === 0 && (
        <div className="card mt-5 flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-badge">
            <Icon d={ICON_PATHS.bot} size={28} stroke="#fff" strokeWidth={2} />
          </div>
          <div className="mt-4 text-lg font-bold">Todavía no tienes agentes</div>
          <p className="mt-1 max-w-[380px] text-sm text-slate2">
            Crea el primero en dos campos: nombre y qué vende. Arranca con{' '}
            {INTERACCIONES_TRIAL} interacciones gratis.
          </p>
          <Link href="/empresa/agentes/nuevo" className="btn-gradient mt-5 px-5 py-3 text-sm">
            Crear mi agente
          </Link>
        </div>
      )}

      {activados.length > 0 && (
        <>
          <div className="mt-6 text-[13px] font-bold text-slate3">VENDIENDO EN REWARDS</div>
          <div className="mt-2 flex flex-col gap-3">
            {activados.map((a) => (
              // El renglón entero no puede ser un <Link>: adentro va otra ancla
              // (el playground) y anidar <a> dentro de <a> es HTML inválido.
              <div
                key={a.assistant_id}
                className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4 transition-all hover:border-cyan1 md:p-5"
              >
                <Link
                  href={`/empresa/agentes/${a.assistant_id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <Avatar url={a.avatar_url} nombre={a.nombre} size={44} icono="bot" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{a.nombre}</div>
                    <div className="mt-0.5 text-xs text-slate3">
                      {a.tenant} · {a.ofertas === 1 ? '1 oferta' : `${a.ofertas} ofertas`}
                    </div>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Estado a={a} />
                  <a
                    href={urlPlayground(a.assistant_id)}
                    target="_blank"
                    rel="noreferrer"
                    title="Probar en el playground de Yaub"
                    className="whitespace-nowrap rounded-xl border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-slate2 transition-colors hover:border-violet1 hover:text-violet1"
                  >
                    Probar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {disponibles.length > 0 && (
        <>
          <div className="mt-7 text-[13px] font-bold text-slate3">
            TUS OTROS AGENTES ({disponibles.length})
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate2">
            Al activarlos les cableamos la skill de Rewards (registrar y validar códigos) para que los vendedores puedan referirles clientes.
          </p>
          <div className="mt-2 flex flex-col gap-2.5">
            {disponibles.map((a) => (
              <div key={a.assistant_id} className="card flex items-center gap-3 p-3.5 md:p-4">
                <Avatar url={a.avatar_url} nombre={a.nombre} size={38} icono="bot" className="opacity-90" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{a.nombre}</div>
                  <div className="text-xs text-slate3">{a.tenant}</div>
                </div>
                <button
                  onClick={() => activar(a.assistant_id)}
                  disabled={activando === a.assistant_id}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate2 transition-colors hover:border-cyan1 hover:text-[#0284C7] disabled:opacity-50"
                >
                  {activando === a.assistant_id ? 'Activando…' : 'Activar Rewards'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
