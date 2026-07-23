'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { mensajeWhatsApp, useCopiar } from '@/components/CodigoBadge';
import { Icon, ICON_PATHS } from '@/components/icons';
import type { CapacitacionTipo } from '@/lib/types';

interface EmpresaMarket {
  id: string;
  nombre: string;
  ofertas: { producto: string; comision_mxn: number; capacitacion: CapacitacionTipo }[];
}

// Paso 2: el código quedó listo — reveal animado + copiar + WhatsApp
export function PasoCodigo({ codigo, onContinuar }: { codigo: string; onContinuar: () => void }) {
  const { copiado, copiar } = useCopiar(codigo);
  return (
    <div className="animate-fadeUp text-center">
      <div className="text-[13px] font-semibold text-slate3">PASO 2 DE 3</div>
      <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Tu código está listo</h1>
      <div
        className="mx-auto mt-7 max-w-[340px] animate-pop rounded-3xl bg-badge p-0.5"
        style={{ boxShadow: '0 16px 40px rgba(139,92,246,.28)' }}
      >
        <div className="rounded-[22px] bg-white px-6 py-8">
          <div className="text-xs font-semibold tracking-[0.14em] text-slate3">TU CÓDIGO ÚNICO</div>
          <div className="text-gradient mt-2 text-[52px] font-extrabold tracking-tight">{codigo}</div>
          <div className="mt-1.5 text-[13px] text-slate2">
            Los clientes lo dirán al agente de IA y la venta será tuya.
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-center gap-2.5">
        <button
          onClick={copiar}
          className="max-w-[165px] flex-1 rounded-[14px] border border-line bg-white py-[13px] text-sm font-semibold transition-colors hover:border-cyan1 hover:text-[#0EA5E9]"
        >
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
        <a
          href={mensajeWhatsApp(codigo)}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[165px] flex-1 rounded-[14px] bg-green1 py-[13px] text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          Compartir · WhatsApp
        </a>
      </div>
      <button
        onClick={onContinuar}
        className="mt-[22px] w-full rounded-2xl bg-ink py-[15px] text-base font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        Continuar
      </button>
    </div>
  );
}

// Paso 3: elegir empresas autorizadas y suscribirse
export function PasoEmpresas({ freelancerId }: { freelancerId: string }) {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaMarket[]>([]);
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase
        .from('empresas')
        .select('id, nombre, ofertas(producto, comision_mxn, capacitacion)')
        .eq('estado', 'autorizada')
        .order('created_at');
      const lista = (data ?? []) as unknown as EmpresaMarket[];
      setEmpresas(lista);
      // Yaub Móvil preseleccionada, como en el diseño
      const pre: Record<string, boolean> = {};
      lista.forEach((e) => {
        pre[e.id] = e.nombre === 'Yaub Móvil';
      });
      setSeleccion(pre);
    };
    cargar();
  }, []);

  const terminar = async () => {
    setGuardando(true);
    const supabase = supabaseBrowser();
    const elegidas = empresas.filter((e) => seleccion[e.id]);
    if (elegidas.length > 0) {
      await supabase
        .from('suscripciones')
        .upsert(
          elegidas.map((e) => ({ freelancer_id: freelancerId, empresa_id: e.id })),
          { onConflict: 'freelancer_id,empresa_id', ignoreDuplicates: true },
        );
    }
    router.push('/app');
    router.refresh();
  };

  return (
    <div className="animate-fadeUp">
      <div className="text-[13px] font-semibold text-slate3">PASO 3 DE 3</div>
      <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Elige a quién vender</h1>
      <p className="mt-1.5 text-sm text-slate2">
        Suscríbete a empresas autorizadas. Puedes cambiar después.
      </p>
      <div className="mt-[22px] flex flex-col gap-3">
        {empresas.map((e) => {
          const on = !!seleccion[e.id];
          const oferta = e.ofertas?.[0];
          return (
            <button
              key={e.id}
              onClick={() => setSeleccion((s) => ({ ...s, [e.id]: !s[e.id] }))}
              className="flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all"
              style={{ borderColor: on ? '#00D4FF' : '#E2E8F0' }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[15px] font-extrabold"
                style={
                  e.nombre === 'Yaub Móvil'
                    ? { background: '#0A0A0F', color: '#fff' }
                    : { background: 'rgba(14,165,233,.12)', color: '#0EA5E9' }
                }
              >
                {e.nombre[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{e.nombre}</div>
                <div className="text-[13px] text-slate2">
                  {oferta ? `$${Math.round(oferta.comision_mxn)} MXN · ${oferta.producto}` : 'Sin oferta activa'}
                </div>
              </div>
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all"
                style={{
                  borderColor: on ? 'transparent' : '#CBD5E1',
                  background: on ? 'linear-gradient(135deg,#00D4FF,#8B5CF6)' : '#fff',
                }}
              >
                {on && <Icon d={ICON_PATHS.check} size={14} stroke="#fff" strokeWidth={3.4} />}
              </div>
            </button>
          );
        })}
        {empresas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-5 text-center text-sm text-slate2">
            Cargando empresas…
          </div>
        )}
      </div>
      <button
        onClick={terminar}
        disabled={guardando}
        className="btn-gradient mt-6 w-full py-[15px] text-base disabled:opacity-60"
      >
        {guardando ? 'Un momento…' : 'Empezar a ganar'}
      </button>
    </div>
  );
}
