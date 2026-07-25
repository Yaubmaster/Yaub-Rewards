const PREGUNTAS = [
  {
    q: '¿Cuánto cuesta usar Yaub Rewards?',
    a: 'Nada, nunca. Es gratis para vendedores y gratis para las empresas que publican. La única condición para las empresas es que la venta pase por los agentes de IA de Yaub.',
  },
  {
    q: '¿Cómo sabe el agente que ese cliente es mío?',
    a: 'Porque el cliente le da tu código. Al cerrar la venta, el agente pregunta quién lo refirió o cómo se enteró; tu cliente responde con tu código y el agente lo registra solo. Ni tú ni él llenan nada.',
  },
  {
    q: '¿Cómo y cuándo cobro mis comisiones?',
    a: 'En cuanto el cliente da tu código, el agente registra tu comisión y la deja pendiente. Él mismo vigila la condición de liberación —por ejemplo, la primera recarga— y la libera sin que tú muevas un dedo. La ves en tu dashboard y la retiras cuando queda liberada, sin mínimos escondidos.',
  },
  {
    q: '¿Necesito saber vender?',
    a: 'No. Tú solo compartes tu código. El agente de IA cotiza, responde dudas, cierra la venta y cobra. Por eso decimos: tú refieres, la IA vende.',
  },
  {
    q: '¿Qué empresas puedo referir?',
    a: 'Todas las publicadas en la plataforma — empezando por Yaub Móvil (36 GB con redes ilimitadas desde $280/mes). Cada semana se suman más.',
  },
  {
    q: '¿Cómo funciona el bono de $50?',
    a: 'Invitas a otro vendedor con tu código: él recibe $50 de bienvenida al registrarse. Cuando cobra su tercera comisión, se liberan sus $50 y tú ganas $100.',
  },
  {
    q: '¿Mi cuenta de yaub.ai sirve aquí?',
    a: 'Sí. Una sola cuenta para todo Yaub: entra con "Entrar con Yaub" y listo.',
  },
];

export function SeccionFaq() {
  return (
    <section className="wrap">
      <p className="kicker" data-r="" style={{ textAlign: 'center' }}>
        Preguntas frecuentes
      </p>
      <h2 data-r="" style={{ textAlign: 'center' }}>
        Lo que todos preguntan.
      </h2>
      <div className="faq" data-r="">
        {PREGUNTAS.map((p) => (
          <details key={p.q}>
            <summary>{p.q}</summary>
            <p>{p.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
