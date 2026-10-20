// Documentos del pedido en HTML sencillo (tablas y estilos en línea) para convertirlos en PDF con Google Drive.
// SOLO servidor. Cada función recibe los datos ya cargados y devuelve el HTML.
import { STAGE_NAME, CHECK, nf, nf1 } from './motor.js';
import { usd } from './costos.js';
import { PASOS, FASES } from './proceso.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fFecha = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' });
const fHora = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
export const fecha = (d) => (d ? fFecha.format(typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00-04:00') : new Date(d)) : '—');
export const fechaHora = (d) => (d ? fHora.format(new Date(d)) : '—');

export function decoTxt(d) {
  d = d || {};
  if (!d.tipo || d.tipo === 'ninguna') return 'Sin estampado';
  const ub = +d.ubicaciones || 1;
  const t = d.tipo === 'serigrafia' ? `Serigrafía ${d.colores || 1} color${(+d.colores || 1) > 1 ? 'es' : ''}` : d.tipo === 'bordado' ? `Bordado ${d.bordadoModo === 'externo' ? 'externo (taller aliado)' : 'interno'}` : d.tipo === 'dtf' ? 'DTF' : 'Vinil';
  return `${t} · ${ub} ubicación${ub > 1 ? 'es' : ''}`;
}

const AZUL = '#0b5563', GRIS = '#5c5c58', LINEA = '#c9d3d8';
const td = (x, extra = '') => `<td style="border:1px solid ${LINEA};padding:6px 8px;vertical-align:top;${extra}">${x}</td>`;
const th = (x, extra = '') => `<td style="border:1px solid ${LINEA};padding:6px 8px;background:#eef3f5;font-weight:bold;${extra}">${x}</td>`;
const R = 'text-align:right;';
const tabla = (filas, ancho = '100%') => `<table style="border-collapse:collapse;width:${ancho};font-size:10pt">${filas.join('')}</table>`;

function marco({ emp, titulo, numero, sub, cuerpo }) {
  const datos = [emp.rif && 'RIF ' + esc(emp.rif), esc(emp.direccion), [emp.telefono, emp.correo].filter(Boolean).map(esc).join(' · ')].filter(Boolean).join('<br>');
  return `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111">
<table style="border-collapse:collapse;width:100%"><tr>
<td style="vertical-align:top;padding:0"><p style="font-size:18pt;font-weight:bold;color:${AZUL};margin:0">${esc((emp.nombre || 'Hawaiira Studio').toUpperCase())}</p><p style="color:${GRIS};font-size:9pt;margin:2px 0 0">${datos}</p></td>
<td style="vertical-align:top;padding:0;text-align:right"><p style="font-size:14pt;font-weight:bold;margin:0">${esc(titulo)}</p><p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:11pt">${esc(numero)}</p><p style="color:${GRIS};font-size:9pt;margin:2px 0 0">${sub}</p></td>
</tr></table>
<hr style="border:0;border-top:2px solid ${AZUL};margin:10px 0 14px">
${cuerpo}
<p style="color:${GRIS};font-size:8pt;margin-top:24px;text-align:center">${esc(emp.nombre || 'Hawaiira Studio')} · Del Taller al Mundo · Documento generado por la app del taller el ${fechaHora(new Date())}</p>
</body></html>`;
}
const h = (t) => `<p style="font-size:11pt;font-weight:bold;color:${AZUL};margin:16px 0 6px">${esc(t)}</p>`;
const firmas = (a, b) => `<table style="border-collapse:collapse;width:100%;margin-top:36px"><tr>
<td style="width:45%;border-top:1px solid #111;padding-top:4px;text-align:center;font-size:9pt">${a}</td><td style="width:10%"></td>
<td style="width:45%;border-top:1px solid #111;padding-top:4px;text-align:center;font-size:9pt">${b}</td></tr></table>`;

// ---------- Cotización ----------
export function htmlCotizacion({ c, emp }) {
  const items = c.items || [];
  const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const filas = [
    `<tr>${th('Descripción')}${th('Cantidad', R)}${th('Precio unitario', R)}${th('Total', R)}</tr>`,
    ...items.map((i) => `<tr>${td(`<b>${esc(i.nombre)}</b>${i.descripcion ? ' · ' + esc(i.descripcion) : ''}<br><span style="color:${GRIS};font-size:9pt">${esc(decoTxt(i.deco))}${i.tallas ? ' · Tallas ' + esc(i.tallas) : ''}</span>`)}${td(nf.format(i.cantidad), R)}${td(usd.format(i.precio), R)}${td(usd.format(i.cantidad * i.precio), R)}</tr>`),
    `<tr>${td('<b>Total</b>', R + 'border-right:0')}${td('', 'border-left:0;border-right:0')}${td('', 'border-left:0')}${td('<b>' + usd.format(total) + '</b>', R)}</tr>`,
  ];
  const cuerpo = `${tabla([`<tr>${th('Cliente')}${th('Válida hasta')}${th('Entrega estimada')}</tr>`, `<tr>${td('<b>' + esc(c.cliente) + '</b>' + (c.contacto ? '<br>' + esc(c.contacto) : ''))}${td(fecha(c.validez))}${td(c.fecha_entrega ? fecha(c.fecha_entrega) : 'Por confirmar')}</tr>`])}
${h('Productos')}${tabla(filas)}
${c.notas ? h('Condiciones') + `<p style="margin:0">${esc(c.notas).replace(/\n/g, '<br>')}</p>` : ''}`;
  return marco({ emp, titulo: 'Cotización', numero: c.numero, sub: fecha(c.creado), cuerpo });
}

// ---------- Orden de producción ----------
export function htmlOrdenProduccion({ o, M, emp, dueno, cot }) {
  const ruta = M.ruta(o);
  const filas = [`<tr>${th('Etapa')}${th('Estación')}${th('Min/pieza', R)}${th('Horas estimadas', R)}${th('Lista de control')}</tr>`,
    ...ruta.map((s) => {
      const ext = M.externo(o, s), mpp = M.mpp(o, s), q = s === 'preprensa' ? 1 : +o.cantidad;
      return `<tr>${td('<b>' + esc(STAGE_NAME[s]) + '</b>')}${td(ext ? 'Taller aliado' : esc(s === 'empaque' ? 'Acabado y empaque' : STAGE_NAME[s]))}${td(ext ? '—' : nf1.format(mpp), R)}${td(ext ? '—' : nf1.format((mpp * q) / 60), R)}${td((CHECK[s] || []).map((x) => '☐ ' + esc(x)).join('<br>'), 'font-size:9pt')}</tr>`;
    })];
  const cuerpo = `${tabla([
    `<tr>${th('Cliente')}${th('Dueño del pedido')}${th('Fecha comprometida')}</tr>`,
    `<tr>${td('<b>' + esc(o.cliente) + '</b>')}${td(esc(dueno || '—'))}${td('<b>' + fecha(o.fechaCompromiso) + '</b>')}</tr>`,
    `<tr>${th('Producto y cantidad')}${th('Estampado')}${th('Orden de compra')}</tr>`,
    `<tr>${td('<b>' + esc(M.prod(o).nombre) + ' × ' + nf.format(o.cantidad) + '</b>' + (o.tallas ? '<br>Tallas: ' + esc(o.tallas) : ''))}${td(esc(decoTxt(o.deco)))}${td(o.ocNumero ? 'OC ' + esc(o.ocNumero) : o.ocArchivo ? 'Adjunta' : 'Sin OC')}</tr>`,
  ])}
${cot ? `<p style="color:${GRIS};font-size:9pt;margin:6px 0 0">Cotización ${esc(cot.numero)}</p>` : ''}
${h('Ruta de producción')}${tabla(filas)}
${h('Estado al emitir')}
<p style="margin:0">${o.arteAprobado || !ruta.includes('preprensa') ? '☑' : '☐'} Arte aprobado &nbsp;&nbsp; ${o.materialListo ? '☑' : '☐'} Material listo &nbsp;&nbsp; ${o.anticipo ? '☑' : '☐'} Anticipo recibido</p>
${o.notas ? h('Notas') + `<p style="margin:0">${esc(o.notas)}</p>` : ''}
${firmas('Planificación<br>Libera la orden', 'Jefe(a) de taller<br>Recibe la orden')}`;
  return marco({ emp, titulo: 'Orden de producción', numero: o.codigo, sub: 'Emitida ' + fecha(o.activado || o.creado), cuerpo });
}

// ---------- Nota de entrega ----------
export function htmlNotaEntrega({ o, M, emp, dueno }) {
  const cuerpo = `${tabla([
    `<tr>${th('Cliente')}${th('Orden de compra')}${th('Contacto en el taller')}</tr>`,
    `<tr>${td('<b>' + esc(o.cliente) + '</b>')}${td(o.ocNumero ? 'OC ' + esc(o.ocNumero) : '—')}${td(esc(dueno || '—'))}</tr>`,
  ])}
${h('Mercancía')}${tabla([
    `<tr>${th('Descripción')}${th('Tallas')}${th('Cantidad', R)}${th('Recibido', R)}</tr>`,
    `<tr>${td('<b>' + esc(M.prod(o).nombre) + '</b><br><span style="font-size:9pt;color:' + GRIS + '">' + esc(decoTxt(o.deco)) + '</span>')}${td(esc(o.tallas || '—'))}${td('<b>' + nf.format(o.cantidad) + '</b>', R)}${td('', R)}</tr>`,
  ])}
${h('Observaciones del cliente al recibir')}
<p style="margin:0;border-bottom:1px solid ${LINEA}">&nbsp;</p><p style="margin:0;border-bottom:1px solid ${LINEA}">&nbsp;</p>
<p style="color:${GRIS};font-size:9pt;margin:10px 0 0">El cliente declara recibir la mercancía descrita, revisada en cantidad y calidad.</p>
${firmas('Entregado por<br>Nombre, firma y fecha', 'Recibido conforme<br>Nombre, cédula, firma y fecha')}`;
  return marco({ emp, titulo: 'Nota de entrega', numero: o.codigo, sub: fecha(o.entregado || new Date()), cuerpo });
}

// ---------- Informe de cierre ----------
export function htmlCierre({ o, M, emp, dueno, regs = [], hitos = [], nombre, K, consumos = [] }) {
  const ruta = M.ruta(o);
  const etapas = ruta.map((s) => {
    const rs = regs.filter((r) => r.etapa === s);
    const piezas = rs.reduce((a, r) => a + r.cantidad, 0), min = rs.reduce((a, r) => a + (+r.minutos || 0), 0);
    return `<tr>${td(esc(STAGE_NAME[s]))}${td(nf.format(piezas), R)}${td(min ? nf1.format(min / 60) : '—', R)}${td(esc([...new Set(rs.map((r) => nombre(r.persona_id)))].filter(Boolean).join(', ') || (M.externo(o, s) ? 'Taller aliado' : '—')))}</tr>`;
  });
  const comp = o.fechaCompromiso, ent = o.entregado ? new Date(o.entregado) : null;
  const diaEnt = ent ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(ent) : null;
  const aTiempo = diaEnt && comp ? diaEnt <= String(comp).slice(0, 10) : null;
  const porPaso = Object.fromEntries(hitos.map((x) => [x.paso, x]));
  const bit = PASOS.filter((p) => porPaso[p.k]).map((p) => { const x = porPaso[p.k]; return `<tr>${td(esc(FASES[p.fase]))}${td(esc(p.nombre))}${td(fechaHora(x.hecho))}${td(esc(nombre(x.por) || (x.auto ? 'Automático' : '—')))}${td(esc(x.nota || ''))}</tr>`; });
  let costos = '';
  if (K) {
    const pres = K.presupuesto(o), real = K.real(o, consumos);
    costos = h('Costos') + tabla([
      `<tr>${th('Concepto')}${th('Presupuestado', R)}${th('Real', R)}</tr>`,
      `<tr>${td('Materiales')}${td(usd.format(pres.materiales), R)}${td(usd.format(real.materiales), R)}</tr>`,
      `<tr>${td('Mano de obra')}${td(usd.format(pres.manoObra), R)}${td(usd.format(real.manoObra), R)}</tr>`,
      pres.externo > 0 ? `<tr>${td('Bordado externo')}${td(usd.format(pres.externo), R)}${td(usd.format(real.externo), R)}</tr>` : '',
      `<tr>${td('Indirectos')}${td(usd.format(pres.indirectos), R)}${td(usd.format(real.indirectos), R)}</tr>`,
      `<tr>${td('<b>Total</b>')}${td('<b>' + usd.format(pres.total) + '</b>', R)}${td('<b>' + usd.format(real.total) + '</b>', R)}</tr>`,
    ]) + (o.monto ? `<p style="margin:6px 0 0">Venta: <b>${usd.format(o.monto)}</b> · Margen real: <b>${nf.format(((o.monto - real.total) / o.monto) * 100)}%</b></p>` : '');
  }
  const cuerpo = `${tabla([
    `<tr>${th('Cliente')}${th('Producto')}${th('Dueño del pedido')}</tr>`,
    `<tr>${td('<b>' + esc(o.cliente) + '</b>')}${td(esc(M.prod(o).nombre) + ' × ' + nf.format(o.cantidad) + '<br><span style="font-size:9pt;color:' + GRIS + '">' + esc(decoTxt(o.deco)) + '</span>')}${td(esc(dueno || '—'))}</tr>`,
    `<tr>${th('Fecha comprometida')}${th('Entregado')}${th('Cumplimiento')}</tr>`,
    `<tr>${td(fecha(comp))}${td(ent ? fecha(ent) : '—')}${td(aTiempo == null ? '—' : aTiempo ? '<b>A tiempo</b>' : '<b style="color:#b3261e">Con atraso</b>')}</tr>`,
  ])}
${h('Producción por etapa')}${tabla([`<tr>${th('Etapa')}${th('Piezas', R)}${th('Horas-persona', R)}${th('Personas')}</tr>`, ...etapas])}
${costos}
${h('Bitácora del pedido')}${tabla([`<tr>${th('Fase')}${th('Paso')}${th('Fecha')}${th('Registrado por')}${th('Nota')}</tr>`, ...bit])}`;
  return marco({ emp, titulo: 'Informe de cierre', numero: o.codigo, sub: 'Pedido cobrado y cerrado', cuerpo });
}
