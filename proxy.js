import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLICAS = ['/login', '/auth', '/api/cron', '/api/version', '/registro', '/api/registro', '/acerca', '/privacidad', '/manifest.webmanifest', '/sw.js', '/icons', '/logo.svg', '/icon.png'];

function faltaConfig(detalle) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui,Arial;max-width:560px;margin:60px auto;padding:0 16px;color:#111">
<img src="/logo.svg" alt="Hawaiira Studio" style="width:200px">
<h1 style="font-size:20px">La app no está conectada a Supabase</h1>
<p style="color:#5C5C58">${detalle}</p>
<ol style="color:#5C5C58;line-height:1.6">
<li>En Vercel abre el proyecto → <b>Settings → Environment Variables</b>.</li>
<li>Revisa que existan, escritas exactamente así: <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> y <code>SUPABASE_SECRET_KEY</code>, marcadas para <b>Production</b>.</li>
<li>Ve a <b>Deployments</b>, abre el menú ⋯ del último despliegue y pulsa <b>Redeploy</b>. Las variables nuevas solo se aplican al volver a desplegar.</li>
</ol></body>`;
  return new NextResponse(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function proxy(request) {
  const urlSb = process.env.NEXT_PUBLIC_SUPABASE_URL, keySb = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!urlSb || !keySb) {
    const faltan = [!urlSb && 'NEXT_PUBLIC_SUPABASE_URL', !keySb && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean).join(' y ');
    return faltaConfig(`Falta ${faltan} en Vercel.`);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(urlSb)) {
    return faltaConfig(`NEXT_PUBLIC_SUPABASE_URL debe tener la forma https://xxxx.supabase.co, sin nada más al final. Ahora dice: ${urlSb.replace(/[<>&"]/g, '')}`);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    urlSb,
    keySb,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims;
  } catch {
    user = null;
  }
  const path = request.nextUrl.pathname;

  if (!user && !PUBLICAS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
