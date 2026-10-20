// Convierte las filas de la plantilla de Excel (o un CSV) en pedidos listos para guardar.
import { isoDay } from './motor.js';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Encabezado de la plantilla → campo interno (se aceptan variaciones)
const COLUMNAS = {
  codigo: ['codigo', 'codigo op', 'op'],
  cliente: ['cliente'],
  producto: ['producto'],
  cantidad: ['cantidad', 'unidades', 'piezas'],
  tallas: ['tallas'],
  estampado: ['estampado', 'tipo de estampado', 'decoracion'],
  colores: ['colores', 'colores serigrafia'],
  ubicaciones: ['ubicaciones'],
  fecha: ['fecha comprometida', 'fecha de entrega', 'entrega', 'fecha'],
  dueno: ['dueno del pedido', 'dueno', 'responsable', 'vendedor'],
  monto: ['monto', 'monto us', 'monto usd', 'monto us$'],
  notas: ['notas', 'observaciones'],
  arte: ['arte aprobado'],
  material: ['material listo'],
  anticipo: ['anticipo', 'anticipo recibido'],
  preprensa: ['preprensa lista', 'preprensa'],
  corte: ['cortadas', 'piezas cortadas', 'corte'],
  serigrafia: ['serigrafiadas', 'piezas serigrafiadas', 'serigrafia'],
  costura: ['cosidas', 'piezas cosidas', 'costura'],
  bordado: ['bordadas', 'piezas bordadas', 'bordado recibidas'],
  dtf: ['dtf vinil aplicadas', 'dtf aplicadas', 'dtf vinil', 'dtf'],
  empaque: ['empacadas', 'piezas empacadas', 'empaque'],
};

const si = (v) => ['si', 's', 'x', 'true', '1', 'yes', 'listo', 'lista', 'ok'].includes(norm(v));

function fecha(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 30000 && v < 80000) { // número de serie de Excel
    const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5);
    return fecha(d);
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // día/mes/año
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function entero(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function leerCSV(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lineas.length) return [];
  const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';
  return lineas.map((l) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  });
}

// filas: arreglo de arreglos (primera fila = encabezados). Devuelve { filas: [{n, orden, errores, avisos}], faltan }
export function interpretar(filas, { M, perfiles, ordenes }) {
  const iHead = filas.findIndex((f) => f && f.some((c) => norm(c) === 'cliente'));
  if (iHead < 0) return { filas: [], faltan: ['No encontré la fila de encabezados (debe tener una columna "Cliente"). Usa la plantilla.'] };
  const head = filas[iHead].map(norm);
  const col = {};
  Object.entries(COLUMNAS).forEach(([k, alias]) => { const i = head.findIndex((h) => alias.includes(h)); if (i >= 0) col[k] = i; });
  const faltan = ['cliente', 'producto', 'cantidad', 'fecha'].filter((k) => col[k] === undefined).map((k) => ({ cliente: 'Cliente', producto: 'Producto', cantidad: 'Cantidad', fecha: 'Fecha comprometida' }[k]));
  if (faltan.length) return { filas: [], faltan: ['Faltan columnas: ' + faltan.join(', ') + '.'] };

  const productos = Object.entries(M.cfg.productos);
  const existentes = new Set(ordenes.map((o) => norm(o.codigo)));
  const vistos = new Set();
  const get = (f, k) => (col[k] === undefined ? null : f[col[k]]);
  const res = [];

  filas.slice(iHead + 1).forEach((f, idx) => {
    if (!f || f.every((c) => c === null || String(c).trim() === '')) return;
    const n = iHead + idx + 2; // número de fila como se ve en Excel
    const cliente = String(get(f, 'cliente') ?? '').trim();
    if (/^ejemplo/i.test(cliente)) return;
    const errores = [], avisos = [];
    if (!cliente) errores.push('Falta el cliente');

    const pv = norm(get(f, 'producto'));
    const prod = productos.find(([k, p]) => norm(k) === pv || norm(p.nombre) === pv || norm(p.nombre) === pv.replace(/s$/, ''));
    if (!pv) errores.push('Falta el producto');
    else if (!prod) errores.push(`Producto "${get(f, 'producto')}" no existe. Agrégalo en Ajustes o usa: ${productos.map(([, p]) => p.nombre).join(', ')}`);

    const cantidad = entero(get(f, 'cantidad'));
    if (!(cantidad > 0)) errores.push('Cantidad inválida');

    const fc = fecha(get(f, 'fecha'));
    if (!fc) errores.push('Fecha comprometida inválida (usa día/mes/año)');

    const ev = norm(get(f, 'estampado'));
    const tipo = !ev || ['sin estampado', 'ninguno', 'ninguna', 'no', 'sin'].includes(ev) ? 'ninguna'
      : ev.startsWith('seri') ? 'serigrafia' : ev.startsWith('dtf') ? 'dtf' : ev.startsWith('vin') ? 'vinil' : ev.startsWith('bord') ? 'bordado' : null;
    const bordadoModo = ev.includes('extern') || ev.includes('aliad') ? 'externo' : 'interno';
    if (!tipo) errores.push(`Estampado "${get(f, 'estampado')}" no válido (Serigrafía, DTF, Vinil, Bordado interno, Bordado externo o Sin estampado)`);

    const colores = Math.max(1, entero(get(f, 'colores')) || 1);
    const ubicaciones = Math.max(1, entero(get(f, 'ubicaciones')) || 1);

    let codigo = String(get(f, 'codigo') ?? '').trim();
    if (codigo) {
      if (/^\d+$/.test(codigo)) codigo = 'OP-' + codigo.padStart(4, '0');
      if (existentes.has(norm(codigo))) errores.push(`El código ${codigo} ya existe en la app`);
      if (vistos.has(norm(codigo))) errores.push(`El código ${codigo} está repetido en el archivo`);
      vistos.add(norm(codigo));
    }

    let responsableId = null;
    const dv = norm(get(f, 'dueno'));
    if (dv) {
      const p = perfiles.find((x) => norm(x.email) === dv || norm(x.nombre) === dv) || perfiles.find((x) => norm(x.nombre).startsWith(dv) || dv.startsWith(norm(x.nombre).split(' ')[0]));
      if (p) responsableId = p.id; else avisos.push(`Dueño "${get(f, 'dueno')}" no está en Usuarios: queda sin dueño`);
    }

    const montoN = Number(String(get(f, 'monto') ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
    const orden = {
      codigo, cliente, producto: prod ? prod[0] : null, cantidad, tallas: String(get(f, 'tallas') ?? '').trim(),
      deco: { tipo: tipo || 'ninguna', colores, ubicaciones, ...(tipo === 'bordado' ? { bordadoModo } : {}) }, fechaCompromiso: fc, monto: Number.isFinite(montoN) ? montoN : 0,
      notas: String(get(f, 'notas') ?? '').trim(), responsableId,
      arteAprobado: si(get(f, 'arte')), materialListo: si(get(f, 'material')), anticipo: si(get(f, 'anticipo')),
    };

    // Avance ya hecho en el taller
    const prog = {}, ultimo = {}, ahora = new Date().toISOString();
    if (cantidad > 0 && tipo) {
      const ruta = M.ruta(orden);
      if (ruta.includes('preprensa') && si(get(f, 'preprensa'))) prog.preprensa = 1;
      ['corte', 'serigrafia', 'costura', 'bordado', 'dtf', 'empaque'].forEach((s) => {
        const v = entero(get(f, s));
        if (v === null || v === 0) return;
        if (Number.isNaN(v) || v < 0) { errores.push(`Avance de ${s} inválido`); return; }
        if (!ruta.includes(s)) { avisos.push(`Ignoré "${s}": este pedido no pasa por esa etapa`); return; }
        if (v > cantidad) avisos.push(`${s}: ${v} es más que la cantidad; quedó en ${cantidad}`);
        prog[s] = Math.min(v, cantidad);
      });
      if (prog.corte === undefined && (prog.costura || prog.serigrafia)) avisos.push('Hay piezas cosidas o estampadas pero no cortadas: revisa los números');
      Object.keys(prog).forEach((s) => { if (prog[s] < (s === 'preprensa' ? 1 : cantidad)) ultimo[s] = ahora; });
      if (fc && fc < isoDay(M.t0)) avisos.push('La fecha comprometida ya pasó');
    }
    res.push({ n, orden: { ...orden, prog, ultimo }, errores, avisos });
  });
  return { filas: res, faltan: [] };
}
