import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { EMPRESA_COOKIE } from '@/lib/empresa';

// Cambia la empresa activa de la oficina (el layout valida que sea del usuario)
export async function POST(request: Request) {
  const { id } = await request.json().catch(() => ({ id: null }));
  if (typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)) {
    cookies().set(EMPRESA_COOKIE, id, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return NextResponse.json({ ok: true });
}
