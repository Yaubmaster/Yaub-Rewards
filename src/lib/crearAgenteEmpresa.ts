import { agentesApi } from '@/lib/agentesApi';

/**
 * Crea el agente de una empresa recién registrada.
 *
 * En Rewards cada empresa ES un agente: al dar de alta el negocio se le arma su
 * agente con un prompt base y sus ofertas como catálogo, para que quede listo
 * para vender sin pasos extra.
 *
 * Nunca lanza: si algo falla, el registro de la empresa igual queda hecho y el
 * usuario puede crear el agente desde la consola con un clic.
 */
export async function crearAgenteDeEmpresa(datos: {
  empresaId: string;
  nombre: string;
  giro?: string | null;
  producto?: string | null;
}): Promise<boolean> {
  const { empresaId, nombre, giro, producto } = datos;

  const queVende = producto?.trim()
    ? `Vendes ${producto.trim()}.`
    : 'Resuelves dudas de los clientes y levantas pedidos.';
  const rubro = giro?.trim() ? ` (${giro.trim()})` : '';

  const prompt =
    `Eres el asistente de ventas de ${nombre}${rubro}. ${queVende} ` +
    `Atiendes en español, con tono cálido y directo, y respondes dudas de precio, ` +
    `disponibilidad y proceso de compra.\n\n` +
    `Al cerrar una venta pregunta SIEMPRE quién refirió al cliente o cómo se enteró. ` +
    `Si te da un código de vendedor, regístralo: de eso depende la comisión de esa persona.`;

  try {
    await agentesApi({
      action: 'quick_create',
      empresa_id: empresaId,
      nombre: `Asistente de ${nombre}`,
      prompt,
    });
    return true;
  } catch {
    return false;
  }
}
