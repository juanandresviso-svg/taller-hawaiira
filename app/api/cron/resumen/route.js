import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { crearMotor, ordenDesdeDb, POOLS, POOL_NAME, pct, fd, isoWeek } from '@/lib/motor';
import { enviarBrevo, htmlResumen } from '@/lib/correo';

export const dynamic = 'force-dynamic';

// Resumen diario de alertas por correo (Brevo). Vercel lo llama según vercel.json.
export async function GET(request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const db = createAdminClient();
  const [{ data: cfg }, { data: ords }, { data: perfiles }, { data: hist }] = await Promise.all([
    db.from('config').select('data').eq('id', 1).single(),
    db.from('ordenes').select('*').eq('estado', 'activo'),
    db.from('perfiles').select('*'),
    db.from('historial').select('*'),
  ]);
  const historial = Object.fromEntries((hist || []).map((h) => [h.semana, h]));
  const M = crearMotor({ config: cfg?.data, ordenes: (ords || []).map(ordenDesdeDb), perfiles: perfiles || [], historial });

  // Guarda la carga de la semana para detectar sobrecargas recurrentes
  const semana = isoWeek(M.t0), prev = (historial[semana] || {}).util || {}, util = {};
  POOLS.forEach((p) => (util[p] = Math.max(prev[p] || 0, Math.round(Math.min(M.util[p].w10.u, 9) * 1000) / 1000)));
  await db.from('historial').upsert({ semana, util, actualizado: new Date().toISOString() });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const fecha = fd(M.t0);
  const carga = POOLS.filter((p) => M.personas(p) > 0).map((p) => ({ nombre: POOL_NAME[p], u: M.util[p].w10.u, txt: pct(M.util[p].w10.u) }));
  const enviados = [];
  for (const p of (perfiles || []).filter((x) => x.activo && x.email && x.rol !== 'operador')) {
    const mias = p.rol === 'direccion'
      ? M.alerts
      : M.alerts.filter((a) => a.para.includes(p.rol) || (a.para.includes('duenos') && a.dueno === p.id));
    if (!mias.length) continue;
    const esDir = p.rol === 'direccion' || p.rol === 'jefa';
    const html = htmlResumen({ nombre: p.nombre.split(' ')[0], fecha, alertas: mias, recs: esDir ? M.recs : [], carga: esDir ? carga : null, site });
    const rojas = mias.filter((a) => a.sev === 'rojo').length;
    try {
      await enviarBrevo({ to: [{ email: p.email, name: p.nombre }], subject: `Taller Hawaiira · ${rojas ? rojas + ' alerta' + (rojas > 1 ? 's' : '') + ' en rojo' : mias.length + ' pendiente' + (mias.length > 1 ? 's' : '')} · ${fecha}`, html });
      enviados.push(p.email);
    } catch (e) {
      console.error('Error enviando a', p.email, e.message);
    }
  }
  return NextResponse.json({ ok: true, enviados: enviados.length });
}
