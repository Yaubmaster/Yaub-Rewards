import Link from 'next/link';
import { ICONO_YAUB } from './reveal';

export function SeccionCtaFinal() {
  return (
    <section className="final wrap">
      <h2 data-r="">
        Empieza a ganar hoy.
        <br />
        <span style={{ color: 'var(--lime)' }}>Gratis.</span>
      </h2>
      <div className="cta-row" data-r="">
        <Link className="btn btn-p" href="/registro">
          Comenzar gratis
        </Link>
        <Link className="btn btn-yaub" href="/login">
          <img className="ico-w" src={ICONO_YAUB} alt="" />
          Entrar con Yaub
        </Link>
      </div>
    </section>
  );
}
