import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { quienLlama } from '@/lib/sesion';
import { googleConfigurado, urlConsentimiento } from '@/lib/drive';
import { siteUrl } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

// Abre la pantalla de Google para dar permiso a la app (solo Dirección)
export async function GET(request) {
  const site = siteUrl(request);
  const yo = await quienLlama();
  if (!yo || yo.rol !== 'direccion') return NextResponse.redirect(site + '/?tab=ajustes&drive=permiso');
  if (!googleConfigurado()) return NextResponse.redirect(site + '/?tab=ajustes&drive=variables');
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(urlConsentimiento(site + '/api/drive/callback', state));
  res.cookies.set('drive_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/drive', maxAge: 600 });
  return res;
}
