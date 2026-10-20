import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { quienLlama } from '@/lib/sesion';
import { estadoDrive, seguimiento } from '@/lib/seguimiento';
import { siteUrl } from '@/lib/sitio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const VEN = ['direccion', 'jefa', 'admin'];

// Estado de la conexión con Google Drive (Ajustes → Google Drive)
export async function GET(request) {
  const yo = await quienLlama();
  if (!yo || !VEN.includes(yo.rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  const db = createAdminClient();
  const est = await estadoDrive(db);
  const { data: docs } = await db.from('documentos').select('clave, tipo, estado, url, error, intentos').in('tipo', ['carpeta', 'hoja', 'documento']);
  const raiz = (docs || []).find((d) => d.clave === 'carpeta:raiz');
  const hoja = (docs || []).find((d) => d.clave === 'hoja');
  const documentos = (docs || []).filter((d) => d.tipo === 'documento');
  return NextResponse.json({
    ...est,
    redirectUri: siteUrl(request) + '/api/drive/callback',
    carpeta: raiz && raiz.estado === 'ok' ? raiz.url : null,
    hoja: hoja && hoja.estado === 'ok' ? hoja.url : null,
    documentos: documentos.filter((d) => d.estado === 'ok').length,
    conError: documentos.filter((d) => d.estado === 'error').map((d) => ({ clave: d.clave, error: d.error, intentos: d.intentos })).slice(0, 10),
  });
}

// Sincronizar ahora: registra los pasos y sube lo que falte (por tandas; la app repite mientras queden pendientes)
export async function POST() {
  const yo = await quienLlama();
  if (!yo || !VEN.includes(yo.rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  try {
    const r = await seguimiento(createAdminClient(), { actor: yo.id, limite: 8 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Desconectar la cuenta de Google (los archivos ya subidos se quedan en Drive)
export async function DELETE() {
  const yo = await quienLlama();
  if (!yo || yo.rol !== 'direccion') return NextResponse.json({ error: 'Solo Dirección puede desconectar Google Drive.' }, { status: 403 });
  const db = createAdminClient();
  const { data } = await db.from('drive_cuenta').select('refresh_token').eq('id', 1).maybeSingle();
  if (data?.refresh_token) await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(data.refresh_token), { method: 'POST' }).catch(() => {});
  await db.from('drive_cuenta').update({ refresh_token: null, ultimo_error: null }).eq('id', 1);
  return NextResponse.json({ ok: true });
}
