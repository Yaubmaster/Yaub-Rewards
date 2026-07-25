import type { CSSProperties } from 'react';

const BARRAS = [30, 45, 38, 60, 52, 74, 68, 90];

export function SeccionDashboard() {
  return (
    <section className="wrap">
      <p className="kicker" data-r="">
        Tu dashboard
      </p>
      <h2 data-r="">
        Plataforma real, <span style={{ color: 'var(--lime)' }}>dinero real.</span>
      </h2>
      <p className="lead" data-r="">
        Todo lo que genera tu código, en un solo lugar: en vivo y sin letras chiquitas.
      </p>
      <div className="dash" data-r="">
        <div className="d-head">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span>rewards.yaub.ai/dashboard</span>
        </div>
        <div className="dgrid">
          <div className="dcard">
            <small>Ganancias totales</small>
            <div className="v lm">$4,850</div>
          </div>
          <div className="dcard">
            <small>Pendientes</small>
            <div className="v gd">$600</div>
          </div>
          <div className="dcard">
            <small>Liberadas</small>
            <div className="v">$4,250</div>
          </div>
          <div className="dcard">
            <small>Ventas de tu red</small>
            <div className="v">32</div>
          </div>
        </div>
        <div className="dbars" aria-hidden="true">
          {BARRAS.map((h, i) => (
            <i key={i} style={{ '--h': h } as CSSProperties} />
          ))}
        </div>
      </div>
    </section>
  );
}
