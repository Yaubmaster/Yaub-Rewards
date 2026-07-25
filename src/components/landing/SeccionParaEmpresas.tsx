import Link from 'next/link';
import { ICONO_YAUB } from './reveal';

export function SeccionParaEmpresas() {
  return (
    <section className="wrap">
      <div className="split">
        <div>
          <p className="kicker" data-r="">
            Para empresas
          </p>
          <h2 data-r="">
            Publica tus productos gratis.{' '}
            <span style={{ color: 'var(--cyan)' }}>Nuestros agentes los venden.</span>
          </h2>
          <ul data-r="">
            <li>Una red de vendedores promoviendo tu marca, sin costo fijo</li>
            <li>Solo participas cuando la IA cierra una venta real</li>
            <li>Crea tu propio agente de IA gratis por 7 días: nombre + prompt y listo</li>
          </ul>
          <Link className="btn btn-p" href="/registro/empresa" data-r="">
            Crear mi agente gratis
          </Link>
        </div>
        <div className="agent-card" data-r="">
          <div className="ac-head">
            <span className="av">
              <img className="ico-w" src={ICONO_YAUB} alt="" />
            </span>
            <div>
              <b>Crea tu agente</b>
              <small>GRATIS POR 7 DÍAS</small>
            </div>
          </div>
          <div className="frow">
            <label>Nombre de tu agente</label>
            <div className="fake">
              Sofi · Asesora de <em>Tu Empresa</em>
            </div>
          </div>
          <div className="frow">
            <label>¿Qué vende y cómo atiende?</label>
            <div className="fake">
              Vende nuestros planes dentales, agenda citas y cobra por WhatsApp con tono amable…
            </div>
          </div>
          <div className="frow" style={{ marginBottom: 0 }}>
            <div
              className="fake"
              style={{
                textAlign: 'center',
                background: 'rgba(34,211,238,0.10)',
                borderColor: 'rgba(34,211,238,0.4)',
                color: 'var(--cyan)',
                fontWeight: 800,
              }}
            >
              ⚡ Tu agente queda listo en minutos
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
