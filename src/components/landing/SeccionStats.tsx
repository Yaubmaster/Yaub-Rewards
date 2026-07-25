import type { StatsLanding } from '@/lib/statsLanding';
import { r } from './reveal';

// Los números salen de rewards.stats_publicas() (ver src/lib/statsLanding.ts).
// data-n / data-grp es el contrato que lee el count-up de LandingPage.
export function SeccionStats({ stats }: { stats: StatsLanding }) {
  return (
    <section className="wrap">
      <p className="kicker" data-r="">
        Números que motivan
      </p>
      <h2 data-r="">Esto ya está pasando.</h2>
      <div className="stats">
        <div className="stat" data-r="" style={r(0)}>
          <div className="n">
            $<span data-n={stats.comisionesPagadasMxn} data-grp="1">0</span>
            <small> MXN</small>
          </div>
          <p>en comisiones pagadas a vendedores</p>
        </div>
        <div className="stat" data-r="" style={r(1)}>
          <div className="n">
            <span data-n={stats.vendedoresActivos} data-grp="1">0</span>
            {stats.vendedoresActivos > 0 && '+'}
          </div>
          <p>vendedores activos ganando con su código</p>
        </div>
        <div className="stat" data-r="" style={r(2)}>
          <div className="n">
            <span data-n={stats.ventasCerradas} data-grp="1">0</span>
            {stats.ventasCerradas > 0 && '+'}
          </div>
          <p>ventas cerradas por agentes de IA</p>
        </div>
        <div className="stat" data-r="" style={r(3)}>
          <div className="n">
            <span data-n={stats.segundosRespuesta}>0</span>
            <small> seg</small>
          </div>
          <p>respuesta promedio del agente — segundos, no horas</p>
        </div>
      </div>
    </section>
  );
}
