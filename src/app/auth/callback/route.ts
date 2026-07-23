import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Intercambia el código del magic link / confirmación de correo por una sesión
// y manda al usuario a su panel (o a terminar su registro).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const base = `${origin}/rewards`;

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: { schema: 'rewards' },
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: freelancer } = await supabase
        .from('freelancers')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (freelancer) return NextResponse.redirect(`${base}/app`);
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (empresa) return NextResponse.redirect(`${base}/empresa`);
      return NextResponse.redirect(`${base}/registro/finalizar`);
    }
  }

  return NextResponse.redirect(`${base}/login`);
}
