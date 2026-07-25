import Link from 'next/link';
import { ICONO_YAUB } from './reveal';

export function SeccionNav() {
  return (
    <nav>
      <div className="navin">
        <img src={ICONO_YAUB} alt="Yaub" />
        <span className="wm">
          Yaub <em>Rewards</em>
        </span>
        <Link className="nav-cta" href="/registro">
          Comenzar gratis
        </Link>
      </div>
    </nav>
  );
}
