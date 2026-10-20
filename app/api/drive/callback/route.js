import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { quienLlama } from '@/lib/sesion';
import { canjearCodigo } from '@/lib/drive';
import { siteUrl } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

// Google regresa aquí después de que la persona da el permiso
export async function GET(request) {
  const site = siteUrl(request);
  const volver = (r) => { const res = NextResponse.redirect(site + '/?tab=ajustes&drive=' + r); res.cookies.delete({ name: 'drive_state', path: '/api/drive' }); return res; };
  const q = new URL(request.url).searchParams;
  if (q.get('error')) return volver('cancelado');
  const yo = await quienLlama();
  if (!yo || yo.rol !== 'direccion') return volver('permiso');
  if (!q.get('state') || q.get('state') !== request.cookies.get('drive_state')?.value) return volver('vencido');
  try {
    const t = await canjearCodigo(q.get('code'), site + '/api/drive/callback');
    if (!t.refresh) return volver('sin-permiso');
    const db = createAdminClient();
    const { data: antes } = await db.from('drive_cuenta').select('email').eq('id', 1).maybeSingle();
    // Otra cuenta de Google: lo exportado antes queda en la cuenta anterior y se arma todo de nuevo en la nueva
    if (antes && antes.email && t.email && antes.email !== t.email) await db.from('documentos').delete().neq('clave', '');
    const { error } = await db.from('drive_cuenta').upsert({ id: 1, email: t.email, refresh_token: t.refresh, conectado: new Date().toISOString(), por: yo.id, ultimo_error: null });
    if (error) throw error;
    return volver('ok');
  } catch (e) {
    console.error('drive callback', e.message);
    return volver('error');
  }
}
