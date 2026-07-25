import { r } from './reveal';

export function SeccionPasos() {
  return (
    <section className="wrap">
      <p className="kicker" data-r="">
        Cómo funciona
      </p>
      <h2 data-r="">
        Tres pasos. <span style={{ color: 'var(--cyan)' }}>Cero broncas.</span>
      </h2>
      <div className="steps3">
        <div className="step3" data-r="" style={r(0)}>
          <span className="num">1</span>
          <h3>Regístrate gratis</h3>
          <p>Crea tu cuenta en un minuto y obtén tu link y código de vendedor únicos.</p>
        </div>
        <div className="step3" data-r="" style={r(1)}>
          <span className="num">2</span>
          <h3>Comparte con quien sea</h3>
          <p>
            Amigos, redes, tu cartera de clientes. Tu link lleva a cada persona directo con el
            agente.
          </p>
        </div>
        <div className="step3" data-r="" style={r(2)}>
          <span className="num">3</span>
          <h3>La IA cierra, tú cobras</h3>
          <p>El agente atiende, cotiza, cierra y cobra. Tu comisión aparece en tu dashboard.</p>
        </div>
      </div>
      <p className="remate" data-r="">
        Sin inventario. Sin atender clientes. Sin invertir un peso.
      </p>
    </section>
  );
}
