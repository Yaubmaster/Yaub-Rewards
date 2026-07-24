export type EmpresaEstado = 'en_revision' | 'autorizada';
export type CapacitacionTipo = 'en_linea' | 'presencial' | 'ninguna';
export type ReferidoEstatus = 'pendiente' | 'liberado' | 'pagado';

export interface Freelancer {
  id: string;
  user_id: string;
  nombre: string;
  telefono: string | null;
  codigo: string;
  clabe: string | null;
  activo: boolean;
  created_at: string;
}

export interface Empresa {
  id: string;
  user_id: string | null;
  nombre: string;
  descripcion: string | null;
  estado: EmpresaEstado;
  created_at: string;
}

export interface Oferta {
  id: string;
  empresa_id: string;
  producto: string;
  descripcion: string | null;
  precio_mxn: number | null;
  fotos: string[];
  comision_mxn: number;
  condicion_liberacion: string | null;
  capacitacion: CapacitacionTipo;
  activa: boolean;
  created_at: string;
}

export interface CapacitacionModulo {
  id: string;
  empresa_id: string;
  titulo: string;
  youtube_url: string;
  orden: number;
  created_at: string;
}

export interface Suscripcion {
  freelancer_id: string;
  empresa_id: string;
  capacitacion_completada: boolean;
  created_at: string;
}

export interface Referido {
  id: string;
  codigo: string;
  freelancer_id: string;
  oferta_id: string;
  cliente_telefono: string;
  tel_norm: string;
  monto_mxn: number;
  estatus: ReferidoEstatus;
  evento_alta: string | null;
  evento_liberacion: string | null;
  conversation_id: string | null;
  created_at: string;
  liberado_at: string | null;
}

export interface Pago {
  id: string;
  freelancer_id: string;
  monto_mxn: number;
  metodo: string | null;
  notas: string | null;
  created_at: string;
}

export const CONDICION_LABELS: Record<string, string> = {
  primera_recarga: 'Primera recarga del referido',
  condicion_cumplida: 'Condición cumplida',
};

export const CAPACITACION_LABELS: Record<CapacitacionTipo, string> = {
  en_linea: 'En línea',
  presencial: 'Presencial',
  ninguna: 'Sin capacitación',
};
