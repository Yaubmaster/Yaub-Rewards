import { Fragment } from 'react';
import { LOGO_ALIANZATEL, LOGO_YAUB_MOVIL } from './reveal';

// Empresas reales publicadas hoy. Al agregar una nueva, basta con sumarla aquí.
const EMPRESAS = [
  { nombre: 'Yaub Móvil', logo: LOGO_YAUB_MOVIL, alto: 32, conNombre: true },
  { nombre: 'Alianzatel', logo: LOGO_ALIANZATEL, alto: 24, conNombre: false },
];

// El carrusel es CSS infinito: el keyframe recorre -50%, así que el contenido
// se repite en dos mitades idénticas. Cada mitad repite las empresas las veces
// necesarias para cubrir pantallas anchas sin dejar huecos.
const REPETICIONES = 3;

function Mitad() {
  return (
    <>
      {Array.from({ length: REPETICIONES }, (_, i) => (
        <Fragment key={i}>
          {EMPRESAS.map((e) => (
            <span className="co" key={e.nombre}>
              <img src={e.logo} alt={e.nombre} style={{ height: e.alto }} />
              {e.conNombre && e.nombre}
            </span>
          ))}
          <span className="co cta-co">¿Tu empresa aquí? Publica gratis →</span>
        </Fragment>
      ))}
    </>
  );
}

export function SeccionEmpresas() {
  return (
    <div className="mq-band" data-r="">
      <p className="mq-label">Empresas que ya venden en Yaub Rewards</p>
      <div className="mq" aria-label="Empresas afiliadas">
        <Mitad />
        <Mitad />
      </div>
    </div>
  );
}
