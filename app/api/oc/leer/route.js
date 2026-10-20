import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { quienLlama } from '@/lib/sesion';
import { leerOrdenCompra } from '@/lib/leerOC';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const PUEDEN = ['direccion', 'jefa', 'admin', 'compras', 'diseno'];
const TIPOS = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' };

// Lee la orden de compra ya subida a la carpeta privada "ordenes-compra" y devuelve sus datos
export async function POST(request) {
  const yo = await quienLlama();
  if (!yo || !PUEDEN.includes(yo.rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  const { ruta } = await request.json().catch(() => ({}));
  if (!ruta || typeof ruta !== 'string' || ruta.includes('..')) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  const { data: blob, error } = await createAdminClient().storage.from('ordenes-compra').download(ruta);
  if (error || !blob) return NextResponse.json({ error: 'No se encontró el archivo subido.' }, { status: 404 });
  const ext = (ruta.split('.').pop() || '').toLowerCase();
  const mime = TIPOS[ext] || blob.type;
  try {
    const r = await leerOrdenCompra({ datos: Buffer.from(await blob.arrayBuffer()), mime });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message, configuracion: !!e.configuracion }, { status: 200 });
  }
}
