// Ofertas publicadas que ve el vendedor. Salen del RPC `ofertas_publicadas`,
// que ya trae la cuenta (tenant), el agente, sus canales, las fotos y si el
// vendedor está suscrito o la marcó como favorita.
import { supabaseBrowser } from '@/lib/supabase/client';

export interface OfertaPublicada {
  oferta_id: string;
  producto: string;
  descripcion: string | null;
  comision_mxn: number;
  precio_mxn: number | null;
  condicion: string | null;
  capacitacion: string;
  fotos: string[];
  creada: string;
  empresa_id: string;
  empresa: string;
  assistant_id: string | null;
  agente: string | null;
  agente_avatar: string | null;
  canales: string[];
  agente_activo: boolean;
  tenant_id: string | null;
  publicado_por: string;
  tenant_avatar: string | null;
  suscrito: boolean;
  favorita: boolean;
}

export async function cargarOfertas(): Promise<OfertaPublicada[]> {
  const { data } = await supabaseBrowser().rpc('ofertas_publicadas');
  return (data ?? []) as unknown as OfertaPublicada[];
}

/**
 * Guarda o quita una oferta de "Mis ofertas". La RLS solo deja guardar ofertas
 * de agentes a los que el vendedor ya está suscrito.
 */
export async function alternarFavorita(
  freelancerId: string,
  ofertaId: string,
  favorita: boolean,
): Promise<void> {
  const supabase = supabaseBrowser();
  if (favorita) {
    const { error } = await supabase
      .from('ofertas_favoritas')
      .delete()
      .eq('freelancer_id', freelancerId)
      .eq('oferta_id', ofertaId);
    if (error) throw new Error('No se pudo quitar de tus ofertas.');
  } else {
    // insert y no upsert: la tabla no tiene grant de UPDATE a propósito
    // (guardar una favorita solo agrega o quita la fila, nunca la edita).
    const { error } = await supabase
      .from('ofertas_favoritas')
      .insert({ freelancer_id: freelancerId, oferta_id: ofertaId });
    // 23505 = ya estaba guardada; no es un error para el vendedor
    if (error && error.code !== '23505') {
      throw new Error('Primero suscríbete a este agente para guardar su oferta.');
    }
  }
}

export const CAPACITACION_TXT: Record<string, string> = {
  en_linea: 'Capacitación en línea',
  presencial: 'Capacitación presencial',
  ninguna: 'Sin capacitación: vendes desde hoy',
};
