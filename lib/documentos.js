// Documentos del pedido en HTML sencillo (tablas y estilos en línea) para convertirlos en PDF con Google Drive.
// SOLO servidor. Cada función recibe los datos ya cargados y devuelve el HTML.
import { STAGE_NAME, CHECK, nf, nf1 } from './motor.js';
import { usd } from './costos.js';
import { PASOS, FASES } from './proceso.js';
import { lineasNota, referenciaPedido, OBS_NOTA, GRACIAS_NOTA } from './notaEntrega.js';
import { codigoProducto, fechaCorta, montoNum, LEYENDA_IVA, OBSERVACIONES_BASE, PAGO_BASE, nombreArchivo } from './formatoCotizacion.js';

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

// ---------- Cotización (formato de Hawaiira Studio) ----------
export function htmlCotizacion({ c, emp, cli = null, productos = {} }) {
  const items = c.items || [];
  const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const unidades = items.reduce((a, i) => a + (+i.cantidad || 0), 0);
  const B = 'border:1px solid #111;padding:5px 7px;';
  const G = 'background:#d9d9d9;font-weight:bold;text-align:center;';
  const m = (v) => '$ ' + montoNum(v);
  const datos = [['# de Cotización', '<b>' + esc(String(c.numero).replace(/^COT-0*/, '')) + '</b>'], ['Fecha', fechaCorta(c.creado)], ['Contacto', esc(c.contacto || (cli && cli.contacto) || '')], ['Cliente', esc(String(c.cliente || '').toUpperCase())], ['RIF', esc((cli && cli.rif) || '')], ['Dirección', esc((cli && cli.direccion) || '')], ['Teléfono', esc((cli && cli.telefono) || '')]];
  return `<html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#111">
<table style="border-collapse:collapse;width:100%"><tr>
<td style="vertical-align:top;padding:0"><table style="border-collapse:collapse">${datos.map(([k, v], i) => `<tr><td style="padding:1px 14px 1px 0;text-align:center;${i ? '' : 'font-weight:bold'}">${k}</td><td style="padding:1px 0">${v}</td></tr>`).join('')}</table></td>
<td style="vertical-align:top;text-align:right;padding:0"><p style="font-size:24pt;font-weight:bold;margin:0;letter-spacing:1px">HAWAIIRA</p><p style="font-size:11pt;letter-spacing:6px;margin:0">— STUDIO —</p></td>
</tr></table>
<p style="margin:10px 0 0"></p>
<table style="border-collapse:collapse;width:100%;font-size:10pt">
<tr><td style="${B}${G}width:11%">Cod.</td><td style="${B}${G}">Descripción</td><td style="${B}${G}width:12%">Cantidad</td><td style="${B}${G}width:16%">Precio Unitario</td><td style="${B}${G}width:16%">Precio Total</td></tr>
${items.map((i) => `<tr><td style="${B}text-align:center">${esc(i.codigo || codigoProducto(i.producto, productos))}</td><td style="${B}">${esc(String(i.descripcion || i.nombre || '').toUpperCase())}</td><td style="${B}text-align:center">${nf.format(i.cantidad)}</td><td style="${B}text-align:right">${m(i.precio)}</td><td style="${B}text-align:right">${m(i.cantidad * i.precio)}</td></tr>`).join('')}
<tr><td colspan="2" style="${B}${G}">SUB-TOTAL</td><td style="${B}text-align:center;font-weight:bold">${nf.format(unidades)}</td><td style="${B}"></td><td style="${B}text-align:right">${m(total)}</td></tr>
</table>
<p style="margin:10px 0 0"></p>
<table style="border-collapse:collapse;width:100%;font-size:10pt">
<tr><td style="${B}${G}width:50%">Observaciones:</td><td style="${B}${G}">Metodos de Pago</td></tr>
<tr><td style="${B}background:#f2f2f2;text-align:center;font-weight:bold;height:60px">${esc(String(c.notas || emp.observaciones || OBSERVACIONES_BASE).toUpperCase())}</td><td style="${B}background:#f2f2f2;text-align:center">${esc(String(c.metodo_pago || emp.metodoPago || PAGO_BASE).toUpperCase())}</td></tr>
</table>
<p style="text-align:center;font-style:italic;margin:4px 0 10px">${esc(emp.leyendaIva || LEYENDA_IVA)}</p>
<p style="margin:0 0 8px">Le(s) damos las gracias por confiar en nosotros.</p>
<p style="margin:0 0 8px">Atentamente,</p>
<p style="text-align:center;color:#8a8a8a;font-size:8.5pt;line-height:1.9;margin:0">${[emp.nombre, emp.rif, emp.direccion, emp.ciudad, [emp.telefono, emp.correo].filter(Boolean).join(' · ')].filter(Boolean).map(esc).join('<br>')}</p>
</body></html>`;
}

// ---------- Orden de producción ----------
export function htmlOrdenProduccion({ o, M, emp, dueno, cot, equipo = null }) {
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
${equipo && equipo.length ? h('Equipo sugerido') + tabla([`<tr>${th('Etapa')}${th('Inicio planificado')}${th('Personas sugeridas')}${th('Máquinas')}</tr>`, ...equipo.map((e) => `<tr>${td('<b>' + esc(e.nombre) + '</b>')}${td(e.externo ? 'Taller aliado' : e.inicio ? fecha(e.inicio) : '—')}${td(e.externo ? '—' : e.personas.length ? esc(e.personas.join(', ')) + (e.necesarias ? `<br><span style="font-size:9pt;color:${GRIS}">${e.necesarias} de ${e.disponibles} en ${esc(e.estacion)}</span>` : '') : e.hecho ? 'Etapa terminada' : 'Sin personas asignadas a la estación')}${td(e.maquinas.length ? e.maquinas.map((m) => esc(m.nombre) + (m.cantidad > 1 ? ' ×' + m.cantidad : '')).join('<br>') : '—', 'font-size:9pt')}</tr>`)]) : ''}
${o.ocMonto != null || o.ocUnidades != null ? `<p style="margin:8px 0 0;color:${GRIS};font-size:9pt">Según la orden de compra: ${o.ocUnidades != null ? nf.format(o.ocUnidades) + ' unidades' : ''}${o.ocUnidades != null && o.ocMonto != null ? ' · ' : ''}${o.ocMonto != null ? usd.format(o.ocMonto) : ''}</p>` : ''}
${h('Estado al emitir')}
<p style="margin:0">${o.arteAprobado || !ruta.includes('preprensa') ? '☑' : '☐'} Arte aprobado &nbsp;&nbsp; ${o.materialListo ? '☑' : '☐'} Material listo &nbsp;&nbsp; ${o.anticipo ? '☑' : '☐'} Anticipo recibido</p>
${o.notas ? h('Notas') + `<p style="margin:0">${esc(o.notas)}</p>` : ''}
${firmas('Planificación<br>Libera la orden', 'Jefe(a) de taller<br>Recibe la orden')}`;
  return marco({ emp, titulo: 'Orden de producción', numero: o.codigo, sub: 'Emitida ' + fecha(o.activado || o.creado), cuerpo });
}

// ---------- Nota de entrega (formato de Hawaiira Studio) ----------
// ordenes: los pedidos que salieron en esta nota (mismo cliente)
export function htmlNotaEntrega({ ordenes, cli = null, productos = {}, cots = [], site = '' }) {
  const o0 = ordenes[0];
  const numero = o0.notaEntrega || o0.codigo;
  const lineas = lineasNota(ordenes, { productos, cots });
  const fechaEnt = ordenes.map((o) => o.entregado).filter(Boolean).sort().pop();
  const obs = ordenes.map((o) => o.notaObs).find(Boolean) || OBS_NOTA;
  const B = 'border:1px solid #111;';
  const datos = [['Nota de Entrega #', '<b>' + esc(numero) + '</b>'], ['Fecha', fechaCorta(fechaEnt || new Date())], ['Cliente', esc(String(o0.cliente || '').toUpperCase())], ['Dirección', esc((cli && cli.direccion) || '')], ['RIF', esc((cli && cli.rif) || '')], ['Pedido', esc(referenciaPedido(ordenes))]];
  return `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111">
<table style="border-collapse:collapse;width:100%"><tr>
<td style="vertical-align:top;padding:0"><table style="border-collapse:collapse">${datos.map(([k, v], i) => `<tr><td style="padding:2px 16px 2px 0;${i ? '' : 'font-weight:bold'}">${k}</td><td style="padding:2px 0">${v}</td></tr>`).join('')}</table></td>
<td style="vertical-align:top;text-align:center;padding:0">${site ? `<img src="${site}/logo-nota.png" width="220">` : '<p style="font-size:24pt;font-weight:bold;margin:0;letter-spacing:1px">HAWAIIRA</p><p style="font-size:11pt;letter-spacing:6px;margin:0">— STUDIO —</p>'}</td>
</tr></table>
<p style="margin:24px 0 0"></p>
<table style="border-collapse:collapse;width:100%;font-size:10pt">
${lineas.map((l) => `<tr><td style="${B}width:9%;height:50px;text-align:center;font-weight:bold">${esc(l.codigo)}</td><td style="${B}text-align:center">${esc(l.descripcion)}</td><td style="${B}width:14%;text-align:center">${nf.format(l.cantidad)}</td></tr>`).join('')}
</table>
<p style="margin:24px 0 0"></p>
<table style="border-collapse:collapse;width:96%;font-family:Calibri,Arial,sans-serif">
<tr><td style="${B}background:#f0f0f0;width:50%;text-align:center;font-weight:bold;font-size:11pt;height:44px">Fecha de recepción y firma del receptor:</td><td style="${B}background:#f0f0f0;text-align:center;font-weight:bold;font-size:11pt">Observaciones:</td></tr>
<tr><td style="${B}background:#f0f0f0;height:60px"></td><td style="${B}background:#f0f0f0;text-align:center;font-weight:bold;font-size:9pt">${esc(obs)}</td></tr>
</table>
<p style="font-family:Calibri,Arial,sans-serif;margin:18px 0 0">${esc(GRACIAS_NOTA)}</p>
<p style="margin:90px 0 0;text-align:right">${site ? `<img src="${site}/sello-hawaiira.png" width="210">` : '<b>Inversiones Hawaiira, C.A.</b>'}</p>
</body></html>`;
}

// ---------- Informe de cierre ----------
export function htmlCierre({ o, M, emp, dueno, regs = [], hitos = [], nombre, K, consumos = [], extras = [] }) {
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
  const bit = PASOS.filter((p) => porPaso[p.k]).map((p) => { const x = porPaso[p.k]; return `<tr>${td(esc(FASES[p.fase]))}${td(p.n + ' · ' + esc(p.nombre))}${td(fechaHora(x.hecho))}${td(esc(nombre(x.por) || (x.auto ? 'Automático' : '—')))}${td(esc(x.nota || ''))}</tr>`; });
  let costos = '';
  if (K) {
    const pres = K.presupuesto(o), real = K.real(o, consumos, extras);
    costos = h('Costos') + tabla([
      `<tr>${th('Concepto')}${th('Presupuestado', R)}${th('Real', R)}</tr>`,
      `<tr>${td('Materiales')}${td(usd.format(pres.materiales), R)}${td(usd.format(real.materiales), R)}</tr>`,
      `<tr>${td('Mano de obra')}${td(usd.format(pres.manoObra), R)}${td(usd.format(real.manoObra), R)}</tr>`,
      pres.externo > 0 ? `<tr>${td('Bordado externo')}${td(usd.format(pres.externo), R)}${td(usd.format(real.externo), R)}</tr>` : '',
      `<tr>${td('Indirectos')}${td(usd.format(pres.indirectos), R)}${td(usd.format(real.indirectos), R)}</tr>`,
      ...real.adicionales.map((x) => `<tr>${td(esc(x.concepto))}${td('—', R)}${td(usd.format(+x.monto || 0), R)}</tr>`),
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
