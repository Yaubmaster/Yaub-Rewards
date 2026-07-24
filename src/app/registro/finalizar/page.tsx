'use client';

// Aterrizaje después de confirmar el correo: crea el perfil según la metadata
// del signup (freelancer o empresa) y continúa el onboarding donde quedó.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PasoCodigo, PasoEmpresas } from '@/components/onboarding/PasosFreelancer';
import type { Freelancer } from '@/lib/types';

export default function FinalizarRegistro() {
  const router = useRouter();
  const [paso, setPaso] = useState<'cargando' | 'codigo' | 'empresas' | 'error'>('cargando');
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);

  useEffect(() => {
    const finalizar = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      // ¿Ya tiene perfil?
      const { data: fl } = await supabase
        .from('freelancers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fl) {
        setFreelancer(fl as Freelancer);
        setPaso('codigo');
        return;
      }
      const { data: emps } = await supabase
        .from('empresas')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      if (emps && emps.length > 0) {
        router.replace('/empresa');
        return;
      }

      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      if (meta.rol === 'empresa') {
        const comisionNum = parseFloat((meta.empresa_comision ?? '').replace(/[^\d.]/g, '')) || 0;
        const { error } = await supabase.rpc('registrar_empresa', {
          p_nombre: meta.empresa_nombre || meta.full_name || 'Mi empresa',
          p_descripcion: meta.empresa_descripcion ?? null,
          p_producto: meta.empresa_producto ?? null,
          p_comision_mxn: comisionNum,
          p_condicion: meta.empresa_condicion ?? null,
          p_capacitacion: (meta.empresa_capacitacion as any) || 'ninguna',
        });
        if (error) {
          setPaso('error');
          return;
        }
        router.replace('/empresa');
        return;
      }

      // Freelancer (default)
      const { data: nuevo, error } = await supabase
        .rpc('registrar_freelancer', {
          p_nombre: meta.full_name || user.email?.split('@')[0] || 'Vendedor',
          p_telefono: meta.phone ?? null,
        })
        .single();
      if (error || !nuevo) {
        setPaso('error');
        return;
      }
      setFreelancer(nuevo as Freelancer);
      setPaso('codigo');
    };
    finalizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,212,255,.08), transparent), radial-gradient(900px 500px at 80% 110%, rgba(139,92,246,.07), transparent), #FFFFFF',
      }}
    >
      <div className="w-full max-w-[420px]">
        {paso === 'cargando' && (
          <div className="flex flex-col gap-4">
            <div className="shimmer h-7 w-3/5 rounded-lg" />
            <div className="shimmer h-[150px] rounded-[20px]" />
            <div className="shimmer h-12 rounded-2xl" />
          </div>
        )}
        {paso === 'codigo' && freelancer && (
          <PasoCodigo codigo={freelancer.codigo} onContinuar={() => setPaso('empresas')} />
        )}
        {paso === 'empresas' && freelancer && <PasoEmpresas freelancerId={freelancer.id} />}
        {paso === 'error' && (
          <div className="animate-fadeUp text-center">
            <h1 className="text-[26px] font-extrabold tracking-tight">Algo salió mal</h1>
            <p className="mt-2 text-[15px] text-slate2">
              No pudimos terminar tu registro. Recarga la página para intentar de nuevo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
