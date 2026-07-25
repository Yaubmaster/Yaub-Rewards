import { ICONO_YAUB } from './reveal';

export function SeccionFooter() {
  return (
    <footer>
      <div className="wrap foot-in">
        <img src={ICONO_YAUB} alt="Yaub" />
        <span>© 2026 Yaub AI · rewards.yaub.ai</span>
        <span className="sp">
          {/* Las páginas legales viven en el sitio principal, no en este repo */}
          <a href="https://yaub.ai/terminos">Términos</a>
          <a href="https://yaub.ai/privacidad">Privacidad</a>
          <a href="https://yaub.ai">yaub.ai</a>
        </span>
      </div>
    </footer>
  );
}
