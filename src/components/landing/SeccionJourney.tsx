import { r } from './reveal';
import type { CSSProperties } from 'react';

// Customer journey de los dos targets. Cada columna se anima al entrar en
// pantalla: la línea se llena de arriba a abajo, los pasos aparecen escalonados
// y el resultado hace count-up al final.
//
// Los números son un ESCENARIO ILUSTRATIVO, no cifras de la plataforma: parten
// de una comisión de $150 (la del ejemplo de Yaub Móvil del hero) y las dos
// columnas cuadran entre sí — 10 vendedores × 3 ventas = las 30 de la empresa.
interface Paso {
  icono: string;
  titulo: string;
  detalle: string;
  dato?: string;
}

const VENDEDOR: Paso[] = [
  { icono: '📝', titulo: 'Te registras gratis', detalle: 'Recibes tu código único, ej. MARI-01', dato: '1 min' },
  { icono: '📲', titulo: 'Compartes tu código', detalle: 'Tu grupo de WhatsApp, tus redes, tu familia', dato: '20 contactos' },
  { icono: '🗣️', titulo: 'Se lo dan al agente', detalle: 'Cuando pregunta quién los refirió', dato: '3 compran' },
  { icono: '💸', titulo: 'Tu comisión se libera sola', detalle: 'El agente la registra y vigila la condición', dato: '$150 c/u' },
];

const EMPRESA: Paso[] = [
  { icono: '🏷️', titulo: 'Publicas tu producto', detalle: 'Gratis. Tú defines la comisión por venta', dato: '$0 de alta' },
  { icono: '🤖', titulo: 'Creas tu agente', detalle: 'Nombre y prompt: queda listo enseguida', dato: '2 min' },
  { icono: '📣', titulo: 'La red te promueve', detalle: 'Cada vendedor comparte tu oferta con su código', dato: '10 vendedores' },
  { icono: '✅', titulo: 'El agente cierra por ti', detalle: 'Atiende, cotiza y cobra sin descanso', dato: '24/7' },
];

function Columna({
  tipo,
  etiqueta,
  titulo,
  pasos,
  prefijo,
  cifra,
  unidad,
  grupo,
  remate,
  nota,
  orden,
}: {
  tipo: 'vendedor' | 'empresa';
  etiqueta: string;
  titulo: string;
  pasos: Paso[];
  prefijo?: string;
  cifra: number;
  unidad: string;
  grupo?: boolean;
  remate: string;
  nota: string;
  orden: number;
}) {
  return (
    <article className={`jcol jcol--${tipo}`} data-r="" style={r(orden)} data-journey="">
      <div className="jhead">
        <span className="jbadge">{etiqueta}</span>
        <h3>{titulo}</h3>
      </div>

      <ol className="jsteps">
        <span className="jline" aria-hidden="true">
          <span className="jline-fill" />
        </span>
        {pasos.map((p, i) => (
          <li className="jstep" key={p.titulo} style={{ '--i': i } as CSSProperties}>
            <span className="jnode" aria-hidden="true">
              {p.icono}
            </span>
            <div className="jtexto">
              <b>{p.titulo}</b>
              <small>{p.detalle}</small>
              {p.dato && <span className="jdato">{p.dato}</span>}
            </div>
          </li>
        ))}
      </ol>

      <div className="jpayoff">
        <div className="jpayoff-n">
          {prefijo}
          <span data-n={cifra} data-grp={grupo ? '1' : undefined} data-delay="2000">
            0
          </span>
          <em>{unidad}</em>
        </div>
        <p className="jpayoff-t">{remate}</p>
        <p className="jpayoff-nota">{nota}</p>
      </div>
    </article>
  );
}

export function SeccionJourney() {
  return (
    <section className="wrap">
      <p className="kicker" data-r="">
        Dos caminos, un mismo agente
      </p>
      <h2 data-r="">Lo que podría pasar.</h2>
      <p className="lead" data-r="">
        Ya seas vendedor o empresa, el agente hace el trabajo pesado. Así se vería tu recorrido
        desde el día uno.
      </p>
      <div className="jgrid">
        <Columna
          tipo="vendedor"
          etiqueta="Si eres vendedor"
          titulo="Ganas sin vender"
          pasos={VENDEDOR}
          prefijo="$"
          cifra={450}
          unidad="MXN"
          grupo
          remate="en tu primer mes, por compartir un código"
          nota="Ejemplo: 3 ventas × $150 de comisión"
          orden={0}
        />
        <Columna
          tipo="empresa"
          etiqueta="Si eres empresa"
          titulo="Vendes sin contratar"
          pasos={EMPRESA}
          cifra={30}
          unidad="ventas"
          remate="al mes, sin un peso de sueldo fijo"
          nota="Ejemplo: 10 vendedores × 3 ventas cada uno"
          orden={1}
        />
      </div>
    </section>
  );
}
