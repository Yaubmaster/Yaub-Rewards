'use client';

// Landing pública de rewards.yaub.ai — composición de las 9 secciones del
// diseño aprobado (design/rewards-reference.html) + las animaciones al hacer
// scroll: reveals escalonados, count-up de los stats, chat escalonado y barra
// de progreso. El carrusel de empresas y el FAQ son CSS/HTML nativo.
import { useEffect, useRef } from 'react';
import { SeccionNav } from './SeccionNav';
import { SeccionHero } from './SeccionHero';
import { SeccionEmpresas } from './SeccionEmpresas';
import { SeccionJourney } from './SeccionJourney';
import { SeccionReferidos } from './SeccionReferidos';
import { SeccionParaEmpresas } from './SeccionParaEmpresas';
import { SeccionDashboard } from './SeccionDashboard';
import { SeccionFaq } from './SeccionFaq';
import { SeccionCtaFinal } from './SeccionCtaFinal';
import { SeccionFooter } from './SeccionFooter';

export function LandingPage() {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = raiz.current;
    if (!nodo) return;

    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fmt = (v: number, grp?: string | null) =>
      Math.round(v).toLocaleString('en-US', { useGrouping: !!grp });

    const cuadros: number[] = [];
    const relojes: ReturnType<typeof setTimeout>[] = [];
    const countUp = (el: HTMLElement) => {
      const target = parseFloat(el.dataset.n ?? '0');
      const grp = el.dataset.grp;
      if (reducido) {
        el.textContent = fmt(target, grp);
        return;
      }
      // data-delay espera a que el elemento aparezca (p. ej. el resultado del
      // journey, que entra al final de la animación de la columna)
      const espera = parseInt(el.dataset.delay ?? '0', 10);
      const correr = () => {
        const t0 = performance.now();
        const dur = 1400;
        const paso = (t: number) => {
          const p = Math.min((t - t0) / dur, 1);
          const e = 1 - Math.pow(1 - p, 4);
          el.textContent = fmt(target * e, grp);
          if (p < 1) cuadros.push(requestAnimationFrame(paso));
        };
        cuadros.push(requestAnimationFrame(paso));
      };
      if (espera > 0) relojes.push(setTimeout(correr, espera));
      else correr();
    };

    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          e.target.querySelectorAll<HTMLElement>('[data-n]').forEach(countUp);
          io.unobserve(e.target);
        }),
      { threshold: 0.2 },
    );
    nodo.querySelectorAll('[data-r],[data-chat],[data-game]').forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      cuadros.forEach(cancelAnimationFrame);
      relojes.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="lp" ref={raiz}>
      <div className="aurora" aria-hidden="true">
        <div className="b b1" />
        <div className="b b2" />
      </div>

      <SeccionNav />

      <main>
        <SeccionHero />
        <SeccionEmpresas />
        <SeccionJourney />
        <SeccionReferidos />
        <SeccionParaEmpresas />
        <SeccionDashboard />
        <SeccionFaq />
        <SeccionCtaFinal />
        <SeccionFooter />
      </main>
    </div>
  );
}
