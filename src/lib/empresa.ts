import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Empresa } from '@/lib/types';

export const EMPRESA_COOKIE = 'rewards_empresa_id';

// Un usuario puede tener varias empresas: la activa se elige con una cookie
// (validada contra sus empresas reales) y por default es la primera.
export async function empresaActiva(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  const empresas = (data ?? []) as Empresa[];
  if (empresas.length === 0) return { empresa: null, empresas };
  const pref = cookies().get(EMPRESA_COOKIE)?.value;
  const empresa = empresas.find((e) => e.id === pref) ?? empresas[0];
  return { empresa, empresas };
}
