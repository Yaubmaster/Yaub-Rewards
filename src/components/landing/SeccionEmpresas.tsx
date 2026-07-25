import { LOGO_ALIANZATEL, LOGO_YAUB_MOVIL } from './reveal';

// El carrusel es CSS infinito: la mitad del contenido se repite para que el
// translateX(-50%) del keyframe cierre sin salto.
function Mitad() {
  return (
    <>
      <span className="co">
        <img src={LOGO_YAUB_MOVIL} alt="Yaub Móvil" />
        Yaub Móvil
      </span>
      <span className="co">
        <img src={LOGO_ALIANZATEL} alt="Alianzatel" style={{ height: 24 }} />
      </span>
      <span className="slot">Logo empresa</span>
      <span className="slot">Logo empresa</span>
      <span className="co cta-co">¿Tu empresa aquí? Publica gratis →</span>
      <span className="slot">Logo empresa</span>
      <span className="slot">Logo empresa</span>
      <span className="slot">Logo empresa</span>
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
