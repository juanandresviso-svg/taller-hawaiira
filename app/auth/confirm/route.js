import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Recibe los enlaces de los correos (invitación y recuperación) y abre la sesión.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/cuenta/clave';
  const destino = next.startsWith('/') ? next : '/';

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/login?error=enlace`);
}
