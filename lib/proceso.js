// Flujo del pedido (flujograma de procesos): de la cotización al cobro.
// Lo usan la app (seguimiento por pedido y pendientes por cargo) y el servidor (hitos y documentos en Drive).

// Los pedidos entregados antes de esta fecha (cuando se activó el seguimiento) se consideran cerrados
export const SEGUIMIENTO_DESDE = '2026-10-20T04:00:00Z';

export const esLegado = (o) => o.estado === 'entregado' && !!o.entregado && new Date(o.entregado) < new Date(SEGUIMIENTO_DESDE);

export const FASES = ['Cotización', 'Aprobación y arte', 'Planificación y compras', 'Producción y calidad', 'Entrega y cobro'];

// modo: 'auto' = la app lo detecta sola · 'flag' = interruptor del pedido · 'manual' = lo marca el responsable
// roles: quién puede marcarlo (Dirección siempre puede) · doc: documento que se guarda en Google Drive al cumplirse
export const PASOS = [
  { k: 'cotizacion', fase: 0, nombre: 'Cotización enviada al cliente', cargo: 'Comercial', modo: 'auto', doc: 'cotizacion', como: 'Se cumple cuando la cotización pasa a "Enviada" en Costos → Cotizaciones.' },
  { k: 'aceptada', fase: 0, nombre: 'Cliente acepta la cotización', cargo: 'Comercial', modo: 'auto', como: 'Se cumple al aprobar la cotización (crea los pedidos).' },
  { k: 'oc', fase: 1, nombre: 'Orden de compra recibida', cargo: 'Comercial', modo: 'auto', doc: 'oc', como: 'Se cumple al subir la OC del cliente (o al activar sin OC).' },
  { k: 'anticipo', fase: 1, nombre: 'Anticipo recibido', cargo: 'Administración', modo: 'flag', campo: 'anticipo', col: 'anticipo', roles: ['admin'] },
  { k: 'arte', fase: 1, nombre: 'Arte final aprobado', cargo: 'Diseño', modo: 'flag', campo: 'arteAprobado', col: 'arte_aprobado', roles: ['diseno', 'jefa'], soloConEstampado: true },
  { k: 'op', fase: 2, nombre: 'Orden de producción emitida', cargo: 'Planificación', modo: 'auto', doc: 'op', como: 'Se emite sola al activar el pedido.' },
  { k: 'material', fase: 2, nombre: 'Material listo en almacén', cargo: 'Compras', modo: 'flag', campo: 'materialListo', col: 'material_listo', roles: ['compras', 'jefa'] },
  { k: 'produccion', fase: 3, nombre: 'Producción terminada', cargo: 'Producción', modo: 'auto', como: 'Se cumple cuando corte, estampado y costura registran todas sus piezas en Mi trabajo.' },
  { k: 'calidad', fase: 3, nombre: 'Control de calidad aprobado', cargo: 'Jefe(a) de taller', modo: 'manual', roles: ['jefa'], nota: 'Observaciones (opcional)' },
  { k: 'empaque', fase: 3, nombre: 'Inspección final y empaque', cargo: 'Empaque', modo: 'auto', doc: 'entrega', como: 'Se cumple cuando empaque registra todas las piezas. Genera la nota de entrega.' },
  { k: 'entrega', fase: 4, nombre: 'Entregado al cliente', cargo: 'Despacho', modo: 'auto', doc: 'entrega', como: 'Se cumple con el botón "Marcar entregado".' },
  { k: 'factura', fase: 4, nombre: 'Saldo facturado', cargo: 'Administración', modo: 'manual', roles: ['admin'], nota: 'N.º de factura' },
  { k: 'cobro', fase: 4, nombre: 'Saldo cobrado · pedido cerrado', cargo: 'Administración', modo: 'manual', roles: ['admin'], nota: 'Referencia del pago', doc: 'cierre' },
];
export const PASO = Object.fromEntries(PASOS.map((p) => [p.k, p]));

// Documentos que se guardan en la carpeta del pedido en Google Drive
export const DOCS = {
  cotizacion: { n: '01', nombre: 'Cotización' },
  oc: { n: '02', nombre: 'Orden de compra del cliente' },
  op: { n: '03', nombre: 'Orden de producción' },
  entrega: { n: '04', nombre: 'Nota de entrega' },
  cierre: { n: '05', nombre: 'Informe de cierre' },
};

export const claveHito = (ordenId, paso) => `op:${ordenId}:${paso}`;
export const puedeMarcar = (paso, rol) => rol === 'direccion' || (paso.roles || []).includes(rol);

// Cotización de la que salió el pedido (la cotización guarda los códigos de los pedidos que creó)
export function cotizacionDe(o, cotizaciones = []) {
  return cotizaciones.find((c) => (c.ordenes || []).includes(o.codigo)) || null;
}

// ¿Se cumple este paso según los datos del pedido? (solo pasos 'auto' y 'flag')
// Devuelve null si no aplica, false si no se cumple, o { cuando, nota } si se cumple.
export function condicion(p, o, { M, cot }) {
  const ruta = M.ruta(o);
  switch (p.k) {
    case 'cotizacion': return cot === undefined ? undefined : !cot ? null : ['enviada', 'aprobada'].includes(cot.estado) ? { cuando: cot.creado, nota: cot.numero } : false;
    case 'aceptada': return cot === undefined ? undefined : !cot ? null : cot.estado === 'aprobada' ? { cuando: o.creado, nota: cot.numero } : false;
    case 'oc': return o.estado !== 'espera' ? { cuando: o.ocSubida || o.activado || o.creado, nota: o.ocNumero ? 'OC ' + o.ocNumero : o.ocArchivo ? '' : 'Activado sin OC' } : false;
    case 'op': return o.estado !== 'espera' ? { cuando: o.activado || o.creado, nota: o.codigo } : false;
    case 'arte': if (!ruta.includes('preprensa')) return null; return o.arteAprobado ? { cuando: null } : false;
    case 'anticipo': case 'material': return o[p.campo] ? { cuando: null } : false;
    case 'produccion': {
      const etapas = ruta.filter((s) => s !== 'empaque' && s !== 'preprensa');
      return etapas.every((s) => M.doneOf(o, s) >= M.tot(o, s)) ? { cuando: ultimoRegistro(o, etapas) } : false;
    }
    case 'empaque': return M.doneOf(o, 'empaque') >= M.tot(o, 'empaque') ? { cuando: ultimoRegistro(o, ['empaque']) } : false;
    case 'entrega': return o.estado === 'entregado' ? { cuando: o.entregado } : false;
  }
  return false;
}
function ultimoRegistro(o, etapas) {
  const ts = etapas.map((s) => (o.ultimo || {})[s]).filter(Boolean).sort();
  return ts.length ? ts[ts.length - 1] : null;
}

// Estado de todos los pasos de un pedido.
// hitos: lista de filas de la tabla hitos de ESTE pedido · cot: cotización (undefined si la persona no puede verlas)
export function pasosDe(o, { M, hitos = [], cot }) {
  const porPaso = Object.fromEntries(hitos.map((h) => [h.paso, h]));
  const lista = PASOS.map((p) => {
    const h = porPaso[p.k] || null;
    let hecho, na = false;
    if (p.modo === 'manual') hecho = !!h;
    else {
      const c = condicion(p, o, { M, cot });
      if (c === undefined) { hecho = !!h; na = !h; } // sin acceso a cotizaciones: se guía por el hito
      else if (c === null) { na = true; hecho = false; }
      else hecho = !!c;
    }
    return { ...p, hecho, na, hito: h, cuando: h ? h.hecho : null, por: h ? h.por : null, nota: h ? h.nota : '' };
  });
  // Con el saldo cobrado el pedido queda cerrado: lo que no se marcó antes queda como omitido
  const cobrado = lista.find((x) => x.k === 'cobro').hecho;
  const legado = !cobrado && esLegado(o);
  const cerrado = cobrado || legado;
  if (cerrado) lista.forEach((x) => { if (!x.na && !x.hecho) x.omitido = true; });
  const pend = lista.filter((x) => !x.na && !x.hecho && !x.omitido);
  const actual = pend.length ? pend[0].fase : FASES.length;
  lista.forEach((x) => { x.accionable = !x.na && !x.hecho && !x.omitido && (x.fase <= actual || x.modo === 'flag'); });
  const hechos = lista.filter((x) => x.hecho).length, aplican = lista.filter((x) => !x.na).length;
  return { lista, fase: actual, siguiente: pend[0] || null, cerrado, legado: !!legado, pendientes: pend, hechos, aplican };
}

// Pasos que el servidor debe tener registrados como hitos automáticos para un pedido
export function hitosAutomaticos(o, { M, cot }) {
  const out = [];
  PASOS.filter((p) => p.modo !== 'manual').forEach((p) => {
    const c = condicion(p, o, { M, cot });
    if (c && typeof c === 'object') out.push({ paso: p.k, cuando: c.cuando || null, nota: c.nota || '' });
  });
  return out;
}

export function faseTexto(f) { return f >= FASES.length ? 'Cerrado' : FASES[f]; }

// Estado del pedido en palabras (equivale a los estados de la OP del flujograma)
export function estadoTexto(o, S) {
  if (S.legado) return 'Entregado (antes del seguimiento)';
  if (S.cerrado) return 'Cobrado · cerrado';
  if (o.estado === 'espera') return 'Por activar · falta la OC';
  if (o.estado === 'entregado') return 'Entregado · por cobrar';
  return faseTexto(S.fase);
}
