import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { quienLlama } from '@/lib/sesion';
import { seguimiento, datosOrdenProduccion, driveConectado } from '@/lib/seguimiento';
import { enviarA } from '@/lib/push';
import { enviarCorreo, correoConfigurado } from '@/lib/correo';
import { siteUrl } from '@/lib/sitio';
import { fecha } from '@/lib/documentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const PUEDEN = ['direccion', 'jefa', 'admin', 'compras', 'diseno'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Envía la orden de producción al taller: la guarda en Drive (PDF), avisa por notificación y por correo con el PDF.
// El pedido ya debe estar activo (la app lo activa al pulsar "Enviar orden de producción").
export async function POST(request) {
  const yo = await quienLlama();
  if (!yo || !PUEDEN.includes(yo.rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  const { ordenId, push = true, correo = true } = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const site = siteUrl(request);
  const res = { ok: true, pdf: null, push: 0, correo: 0, avisos: [] };

  // 1) Registra el paso 14 y genera los documentos del pedido en Drive
  try { await seguimiento(db, { actor: yo.id, limite: 4, soloOrden: ordenId }); } catch (e) { res.avisos.push('Seguimiento: ' + e.message); }
  const D = await driveConectado(db);
  let pdf = null;
  if (D) {
    for (let i = 0; i < 8; i++) { // si otra llamada lo está generando, espera a que termine
      const { data: doc } = await db.from('documentos').select('estado, url, drive_id').eq('clave', `doc:op:${ordenId}:op`).maybeSingle();
      if (doc && doc.estado === 'ok') { res.pdf = doc.url; try { pdf = await D.descargar(doc.drive_id); } catch (e) { res.avisos.push('No se pudo adjuntar el PDF: ' + e.message); } break; }
      if (doc && doc.estado === 'error') { res.avisos.push('No se pudo guardar la OP en Drive.'); break; }
      await espera(2500);
    }
  } else res.avisos.push('Google Drive no está conectado: la orden va en el cuerpo del correo, sin PDF.');

  const X = await datosOrdenProduccion(db, ordenId);
  if (!X) return NextResponse.json({ error: 'No se encontró el pedido.' }, { status: 404 });
  const { o, perfiles } = X;
  if (o.estado === 'espera') return NextResponse.json({ error: 'El pedido todavía no está activo.' }, { status: 400 });
  if (!o.opEnviada) await db.from('ordenes').update({ op_enviada: new Date().toISOString(), op_enviada_por: yo.id }).eq('id', o.id);

  // 2) Destinatarios: jefe(a) de taller, dirección, compras y el dueño del pedido
  const dest = perfiles.filter((p) => p.activo !== false && (['jefa', 'direccion', 'compras'].includes(p.rol) || p.id === o.responsableId));
  const prod = X.M.prod(o).nombre;
  const resumen = `${o.cliente} · ${prod} × ${o.cantidad} · entrega ${fecha(o.fechaCompromiso)}`;

  if (push) {
    try { res.push = await enviarA(db, dest.filter((p) => p.id !== yo.id).map((p) => p.id), { title: `Nueva orden de producción ${o.codigo}`, body: resumen + '. Ya entra en el plan del taller.', url: '/?tab=pedidos', tag: 'op:' + o.id, tipo: 'pedidos' }); } catch (e) { res.avisos.push('Notificación: ' + e.message); }
  }
  if (correo) {
    if (!correoConfigurado()) res.avisos.push('El correo del taller no está configurado.');
    else {
      const para = dest.filter((p) => p.email).map((p) => ({ name: p.nombre, address: p.email }));
      const cab = `<p style="font-family:Arial,sans-serif;font-size:14px">Se envió la <b>orden de producción ${esc(o.codigo)}</b> al taller.<br>${esc(resumen)}${res.pdf ? `<br><a href="${res.pdf}">Ver la orden en Google Drive</a>` : ''}<br><a href="${site}/?tab=pedidos">Abrir la app del taller</a></p><hr>`;
      if (para.length) {
        try {
          await enviarCorreo({ to: para, subject: `Orden de producción ${o.codigo} · ${o.cliente}`, html: cab + (pdf ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#5c5c58">La orden de producción va adjunta en PDF.</p>' : X.html), attachments: pdf ? [{ filename: `Orden de producción ${o.codigo}.pdf`, content: pdf, contentType: 'application/pdf' }] : [] });
          res.correo = para.length;
        } catch (e) { res.avisos.push('Correo: ' + e.message); }
      }
    }
  }
  res.whatsapp = `*Orden de producción ${o.codigo}*\n${o.cliente}\n${prod} × ${o.cantidad}${o.tallas ? ' (' + o.tallas + ')' : ''}\nEntrega: ${fecha(o.fechaCompromiso)}\n` +
    X.equipo.filter((e) => !e.hecho).map((e) => `• ${e.nombre}: ${e.externo ? 'taller aliado' : e.personas.join(', ') || 'por asignar'}`).join('\n') +
    (res.pdf ? `\nPDF: ${res.pdf}` : '') + `\n${site}`;
  return NextResponse.json(res);
}
