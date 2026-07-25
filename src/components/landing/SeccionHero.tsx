import Link from 'next/link';
import { ICONO_YAUB, r } from './reveal';

export function SeccionHero() {
  return (
    <header className="hero wrap">
      <div className="hero-grid">
        <div>
          <span className="pill" data-r="" style={r(0)}>
            <span className="dot" />
            Gratis, para siempre · Ya en producción
          </span>
          <h1 data-r="" style={r(1)}>
            Tú refieres.
            <br />
            <span className="cy">La IA vende.</span>
            <br />
            <span className="lm">Tú cobras.</span>
          </h1>
          <p className="sub" data-r="" style={r(2)}>
            Comparte tu código único. Los agentes de IA de Yaub atienden, cierran la venta y
            registran tu comisión solos — tú no tocas nada. No son bots. Son agentes autónomos.
          </p>
          <div className="cta-row" data-r="" style={r(3)}>
            <Link className="btn btn-p" href="/registro">
              Comenzar gratis
            </Link>
            <Link className="btn btn-yaub" href="/login">
              <img className="ico-w" src={ICONO_YAUB} alt="" />
              Entrar con Yaub
            </Link>
            <p className="sso-note">Es la misma cuenta que usas en yaub.ai</p>
          </div>
        </div>

        <div className="hero-vis" data-r="" style={r(2)} data-chat="">
          <div className="phone">
            <div className="ph-head">
              <span className="av">
                <img className="ico-w" src={ICONO_YAUB} alt="" />
              </span>
              <div>
                <b>Yaub Agent · Yaub Móvil</b>
                <small>● en línea, siempre</small>
              </div>
            </div>
            <div className="chat">
              <div className="msg them">Hola 👋 ¿cómo está eso del plan de 36 GB?</div>
              <div className="msg me">
                ¡Hola! 36 GB + redes sociales ilimitadas desde $280/mes. Te lo activo en minutos,
                ¿te mando el link de pago? <span className="t">14:02</span>
              </div>
              <div className="msg them">Va, mándalo 🙌</div>
              <div className="msg me">
                Listo ✅ Pago confirmado y tu SIM va en camino. Una última cosa: ¿alguien te
                recomendó?
              </div>
              <div className="msg them">Sí, Karla. Su código es KARL-01</div>
              <div className="msg me">
                ¡Anotado! La comisión de Karla ya quedó registrada. Aquí ando 24/7.{' '}
                <span className="t">14:06</span>
              </div>
            </div>
            <div className="notif">
              <span className="ic">💸</span>
              <div>
                <b>Comisión registrada +$150 MXN</b>
                <small>Tu agente la libera al cumplirse la condición</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
