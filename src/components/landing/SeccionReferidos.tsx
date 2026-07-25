export function SeccionReferidos() {
  return (
    <section className="wrap">
      <div className="game">
        <div>
          <p className="kicker" data-r="">
            Refiere vendedores
          </p>
          <h2 data-r="">
            Invita vendedores, <span style={{ color: 'var(--gold)' }}>gana doble.</span>
          </h2>
          <p className="lead" data-r="">
            Invita a otro vendedor con tu código. Él recibe{' '}
            <b style={{ color: 'var(--ink)' }}>$50 de bienvenida</b> al registrarse. Cuando cobre su
            tercera comisión, se liberan sus $50 — y tú ganas{' '}
            <b style={{ color: 'var(--gold)' }}>$100</b>.
          </p>
        </div>
        <div className="gcard" data-r="" data-game="">
          <p className="glabel">Tu referido: Luis M.</p>
          <div className="grow">
            <span className="coin">$100</span>
            <div>
              <b>Comisiones de tu referido: 2/3</b>
              <small>Le falta 1 para liberar tus $100</small>
            </div>
          </div>
          <div className="track">
            <div className="fill" />
          </div>
          <div className="gfoot">
            <span>2 de 3 comisiones</span>
            <b>+$100 MXN por liberar</b>
          </div>
          <div className="badges">
            <span className="badge-g on">🏅 Primer referido</span>
            <span className="badge-g on">💰 Primera comisión</span>
            <span className="badge-g">🚀 5 referidos</span>
          </div>
        </div>
      </div>
    </section>
  );
}
