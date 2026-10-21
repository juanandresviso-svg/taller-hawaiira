// Flujo del pedido: los 31 pasos del flujograma de procesos, de la solicitud de cotización al cobro.
// Lo usan la app (seguimiento, pendientes por cargo) y el servidor (hitos, documentos y hoja en Drive).
// Los pasos 1 a 8 pertenecen a la cotización; del 9 al 31, a cada pedido (orden de producción).

// Los pedidos entregados antes de esta fecha (cuando se activó el seguimiento) se consideran cerrados
export const SEGUIMIENTO_DESDE = '2026-10-20T04:00:00Z';
export const esLegado = (o) => o.estado === 'entregado' && !!o.entregado && new Date(o.entregado) < new Date(SEGUIMIENTO_DESDE);

export const FASES = ['Cotización', 'Aprobación y arte', 'Planificación y compras', 'Producción y calidad', 'Entrega y cobro'];
export const TOTAL_PASOS = 31;

// modo: 'auto' = la app lo detecta · 'flag' = interruptor del pedido · 'manual' = lo marca el responsable
//       'eleccion' = el responsable elige una opción · 'espejo' = decisión que se cumple con el paso "de"
// roles: quién puede marcarlo ('dueno' = dueño del pedido; Dirección siempre puede)
// doc: documentos que se guardan en Drive al cumplirse · nivel 'cot' = paso de la cotización
const ED = ['jefa', 'admin', 'compras', 'diseno'];
export const PASOS = [
  { k: 'p01', fase: 0, nivel: 'cot', nombre: 'Cliente solicita cotización', cargo: 'Ventas', modo: 'auto', como: 'Se cumple cuando Ventas registra la solicitud del cliente.' },
  { k: 'p02', fase: 0, nivel: 'cot', nombre: 'Solicitud procesada y pasada a cotizar', cargo: 'Ventas', modo: 'auto', como: 'Se cumple al generar la cotización a partir de la solicitud.' },
  { k: 'p03', fase: 0, nivel: 'cot', nombre: 'Ficha técnica preliminar y mockup', cargo: 'Diseño', modo: 'manual', roles: ['diseno', 'jefa', 'admin'], nota: 'Comentario (opcional)' },
  { k: 'p04', fase: 0, nivel: 'cot', nombre: 'Costo y precio calculados', cargo: 'Comercial', modo: 'auto', como: 'Se cumple cuando la cotización tiene precios.' },
  { k: 'p05', fase: 0, nivel: 'cot', nombre: 'Dirección aprueba precio, descuento y fecha', cargo: 'Dirección', modo: 'manual', roles: [], decision: true, nota: 'Comentario (opcional)' },
  { k: 'p06', fase: 0, nivel: 'cot', nombre: 'Cotización y mockup enviados al cliente', cargo: 'Comercial', modo: 'auto', doc: ['cotizacion'], como: 'Se cumple al pasar la cotización a "Enviada".' },
  { k: 'p07', fase: 0, nivel: 'cot', nombre: 'Cliente acepta la cotización', cargo: 'Cliente', modo: 'auto', decision: true, como: 'Se cumple al aprobar la cotización (crea los pedidos).' },
  { k: 'p08', fase: 0, nivel: 'cot', nombre: 'Cierre por rechazo y seguimiento', cargo: 'Comercial', modo: 'auto', como: 'Solo si el cliente rechaza la cotización.' },
  { k: 'p09', fase: 1, nombre: 'Proforma de anticipo emitida', cargo: 'Administración', modo: 'manual', roles: ['admin'], nota: 'N.º de proforma' },
  { k: 'p10', fase: 1, nombre: 'Cliente paga el anticipo', cargo: 'Administración', modo: 'flag', campo: 'anticipo', col: 'anticipo', roles: ['admin'] },
  { k: 'p11', fase: 1, nombre: 'Anticipo recibido', cargo: 'Administración', modo: 'espejo', de: 'p10', decision: true },
  { k: 'p12', fase: 1, nombre: 'Arte final y archivos de producción', cargo: 'Diseño', modo: 'manual', roles: ['diseno', 'jefa'], conEstampado: true, nota: 'Archivos listos (opcional)' },
  { k: 'p13', fase: 1, nombre: 'Cliente aprueba el arte final', cargo: 'Diseño', modo: 'flag', campo: 'arteAprobado', col: 'arte_aprobado', roles: ['diseno', 'jefa'], conEstampado: true, decision: true },
  { k: 'p14', fase: 2, nombre: 'Orden de producción creada y enviada al taller', cargo: 'Planificación', modo: 'auto', doc: ['oc', 'op'], accion: 'enviarOP', roles: ['dueno', ...ED], como: 'Se cumple con "Enviar orden de producción".' },
  { k: 'p15', fase: 2, nombre: 'Revisión de material en almacén', cargo: 'Compras', modo: 'eleccion', roles: ['compras', 'jefa'], decision: true, opciones: [['hay', 'Hay material'], ['falta', 'Falta: hay que comprar']] },
  { k: 'p16', fase: 2, nombre: 'Compra al proveedor', cargo: 'Compras', modo: 'manual', roles: ['compras'], siFalta: true, nota: 'Proveedor y n.º de orden' },
  { k: 'p17', fase: 2, nombre: 'Pago al proveedor', cargo: 'Administración', modo: 'manual', roles: ['admin'], siFalta: true, nota: 'Referencia del pago' },
  { k: 'p18', fase: 2, nombre: 'Material recibido y en almacén', cargo: 'Compras', modo: 'manual', roles: ['compras'], siFalta: true, nota: 'N.º de nota de recepción' },
  { k: 'p19', fase: 2, nombre: 'Material reservado · OP liberada a producción', cargo: 'Planificación', modo: 'flag', campo: 'materialListo', col: 'material_listo', roles: ['compras', 'jefa'] },
  { k: 'p20', fase: 3, nombre: 'Corte terminado', cargo: 'Producción', modo: 'auto', etapas: ['corte'], como: 'Se cumple cuando corte registra todas las piezas en Mi trabajo.' },
  { k: 'p21', fase: 3, nombre: 'Costura terminada', cargo: 'Producción', modo: 'auto', etapas: ['costura'], como: 'Se cumple cuando costura registra todas las piezas.' },
  { k: 'p22', fase: 3, nombre: 'Serigrafía, DTF, vinil o bordado terminado', cargo: 'Producción', modo: 'auto', etapas: ['serigrafia', 'bordado', 'dtf'], como: 'Se cumple cuando el estampado registra todas las piezas.' },
  { k: 'p23', fase: 3, nombre: 'Control de calidad aprobado', cargo: 'Jefe(a) de taller', modo: 'manual', roles: ['jefa'], decision: true, nota: 'Observaciones (opcional)' },
  { k: 'p24', fase: 4, nombre: 'Inspección final, etiquetado y empaque', cargo: 'Empaque', modo: 'auto', etapas: ['empaque'], como: 'Se cumple cuando empaque registra todas las piezas.' },
  { k: 'p25', fase: 4, nombre: 'Cliente avisado: pedido listo', cargo: 'Comercial', modo: 'manual', roles: ['dueno', 'admin'], nota: 'Cómo se avisó (opcional)' },
  { k: 'p26', fase: 4, nombre: 'Entregado o despachado con nota de entrega', cargo: 'Despacho', modo: 'auto', doc: ['entrega'], como: 'Se cumple con "Marcar entregado": la app genera la nota de entrega numerada.' },
  { k: 'p27', fase: 4, nombre: 'Cliente recibe y firma conformidad', cargo: 'Cliente', modo: 'manual', roles: ['dueno', 'admin', 'jefa'], nota: 'Recibido por' },
  { k: 'p28', fase: 4, nombre: 'Saldo facturado', cargo: 'Administración', modo: 'manual', roles: ['admin'], nota: 'N.º de factura' },
  { k: 'p29', fase: 4, nombre: 'Cliente paga el saldo', cargo: 'Administración', modo: 'manual', roles: ['admin'], nota: 'Referencia del pago' },
  { k: 'p30', fase: 4, nombre: 'Saldo cobrado', cargo: 'Administración', modo: 'espejo', de: 'p29', decision: true },
  { k: 'p31', fase: 4, nombre: 'OP cerrada · costo real vs. presupuesto', cargo: 'Administración', modo: 'espejo', de: 'p29', doc: ['cierre'] },
].map((p, i) => ({ ...p, n: i + 1, nivel: p.nivel || 'op' }));
export const OPCIONES_P15 = { hay: 'Hay material', falta: 'Faltaba material: se compró' };
export const PASO = Object.fromEntries(PASOS.map((p) => [p.k, p]));
export const PASOS_COT = PASOS.filter((p) => p.nivel === 'cot');
export const PASOS_OP = PASOS.filter((p) => p.nivel === 'op');

// Documentos que se guardan en la carpeta del pedido en Google Drive
export const DOCS = {
  cotizacion: { n: '01', nombre: 'Cotización' },
  oc: { n: '02', nombre: 'Orden de compra del cliente' },
  op: { n: '03', nombre: 'Orden de producción' },
  entrega: { n: '04', nombre: 'Nota de entrega' },
  cierre: { n: '05', nombre: 'Informe de cierre' },
};

export const claveHito = (ordenId, paso) => `op:${ordenId}:${paso}`;
export const claveHitoCot = (cotId, paso) => `cot:${cotId}:${paso}`;

// ¿Puede esta persona marcar el paso? (perfil = { id, rol }; o = pedido, para el dueño)
export function puedeMarcar(p, perfil, o) {
  if (!perfil) return false;
  if (perfil.rol === 'direccion') return true;
  const r = p.roles || [];
  return r.includes(perfil.rol) || (r.includes('dueno') && !!o && o.responsableId === perfil.id);
}

// Cotización de la que salió el pedido
export function cotizacionDe(o, cotizaciones = []) {
  return cotizaciones.find((c) => c.id === o.cotizacionId) || cotizaciones.find((c) => (c.ordenes || []).includes(o.codigo)) || null;
}

const ultimo = (o, etapas) => { const ts = etapas.map((s) => (o.ultimo || {})[s]).filter(Boolean).sort(); return ts.length ? ts[ts.length - 1] : null; };

// Condición de los pasos automáticos. Devuelve null (no aplica), false (pendiente),
// { cuando, nota } (cumplido) o undefined (no se puede saber: la persona no ve las cotizaciones).
function condicion(p, { o, cot, M, H }) {
  if (p.nivel === 'cot') {
    if (cot === undefined) return undefined;
    if (!cot) return null;
    const est = cot.estado;
    switch (p.k) {
      case 'p01': case 'p02': return { cuando: cot.creado, nota: cot.numero };
      case 'p04': return +cot.total > 0 ? { cuando: cot.creado, nota: cot.numero } : false;
      case 'p06': return ['enviada', 'aprobada', 'rechazada'].includes(est) ? { cuando: null, nota: cot.numero } : false;
      case 'p07': return est === 'aprobada' ? { cuando: null, nota: cot.numero } : est === 'rechazada' ? null : false;
      case 'p08': return o ? null : est === 'rechazada' ? { cuando: null, nota: cot.numero } : est === 'aprobada' ? null : false;
    }
    return false;
  }
  const ruta = M.ruta(o);
  const hecho = (etapas) => { const es = ruta.filter((s) => etapas.includes(s)); if (!es.length) return null; return es.every((s) => M.doneOf(o, s) >= M.tot(o, s)) ? { cuando: ultimo(o, es) } : false; };
  switch (p.k) {
    case 'p10': return o.anticipo ? { cuando: null } : false;
    case 'p13': if (!ruta.includes('preprensa')) return null; return o.arteAprobado ? { cuando: null } : false;
    case 'p14': return o.estado !== 'espera' ? { cuando: o.opEnviada || o.activado || o.creado, nota: o.ocNumero ? 'OC ' + o.ocNumero : o.ocArchivo ? 'Con OC' : 'Sin OC' } : false;
    case 'p15': return H.p15 && !H.p15.auto ? { cuando: H.p15.hecho, nota: H.p15.nota } : o.materialListo ? { cuando: null, nota: 'hay' } : false;
    case 'p19': return o.materialListo ? { cuando: null } : false;
    case 'p20': case 'p21': case 'p22': case 'p24': return hecho(p.etapas);
    case 'p26': return o.estado === 'entregado' ? { cuando: o.entregado } : false;
  }
  return false;
}

// Estado de cada paso. o: pedido (null si es solo una cotización) · cot: cotización (undefined si no se ve)
// hitos: los del pedido y los de su cotización
export function evaluarPasos({ o = null, cot, M, hitos = [] }) {
  const H = {};
  hitos.forEach((h) => { H[h.paso] = h; });
  const lista = [];
  const R = {};
  for (const p of o ? PASOS : PASOS_COT) {
    const h = H[p.k] || null;
    let hecho = false, na = false, nota = h ? h.nota : '';
    if (p.nivel === 'cot' && o && !o.cotizacionId && cot == null) na = true; // pedido sin cotización en la app
    else if (p.conEstampado && o && !M.ruta(o).includes('preprensa')) na = true;
    else if (p.siFalta) { const r15 = R.p15; na = !!(r15 && r15.hecho && r15.nota !== 'falta'); hecho = !na && !!h; }
    else if (p.modo === 'manual') hecho = !!h;
    else if (p.modo === 'espejo') { hecho = !!(R[p.de] && R[p.de].hecho); if (!h && R[p.de] && R[p.de].hito) nota = R[p.de].nota; }
    else {
      const c = condicion(p, { o, cot, M, H });
      if (c === undefined) { hecho = !!h; na = !h && p.k === 'p08'; }
      else if (c === null) na = true;
      else { hecho = !!c; if (c && !h) nota = c.nota || ''; }
    }
    const x = { ...p, hecho, na, hito: h, cuando: h ? h.hecho : null, por: h ? h.por : null, nota };
    if (p.modo === 'espejo' && !h && R[p.de] && R[p.de].hecho) { x.cuando = R[p.de].cuando; x.por = R[p.de].por; }
    R[p.k] = x;
    lista.push(x);
  }
  const cerrado = o ? (R.p31.hecho || esLegado(o)) : (R.p07.hecho || R.p08.hecho);
  const legado = !!(o && !R.p31.hecho && esLegado(o));
  if (cerrado) lista.forEach((x) => { if (!x.na && !x.hecho) x.omitido = true; });
  const pend = lista.filter((x) => !x.na && !x.hecho && !x.omitido);
  const fase = pend.length ? pend[0].fase : FASES.length;
  lista.forEach((x) => { x.accionable = !x.na && !x.hecho && !x.omitido && (x.fase <= fase || x.modo === 'flag'); });
  return {
    lista, por: R, fase, siguiente: pend[0] || null, cerrado, legado, pendientes: pend,
    hechos: lista.filter((x) => x.hecho).length, aplican: lista.filter((x) => !x.na).length,
  };
}

// Atajo para un pedido: junta los hitos del pedido y los de su cotización
export function pasosDe(o, { M, hitos = [], hitosCot = [], cot }) {
  return evaluarPasos({ o, cot, M, hitos: [...hitosCot, ...hitos] });
}

// Hitos automáticos que el servidor debe tener registrados (pedido o cotización)
export function hitosAutomaticos({ o = null, cot, M, hitos = [] }) {
  const S = evaluarPasos({ o, cot, M, hitos });
  return S.lista.filter((x) => x.hecho && (o ? x.nivel === 'op' : x.nivel === 'cot') && ['auto', 'flag', 'espejo', 'eleccion'].includes(x.modo) && !(x.modo === 'eleccion' && x.hito && !x.hito.auto))
    .map((x) => ({ paso: x.k, cuando: condCuando(x, o), nota: x.nota || '' }));
}
function condCuando(x, o) {
  if (x.modo === 'espejo') return x.cuando || null;
  if (x.k === 'p01' || x.k === 'p02' || x.k === 'p04') return x.cuando || null;
  if (!o) return null;
  if (x.k === 'p14') return o.opEnviada || o.activado || o.creado;
  if (x.k === 'p26') return o.entregado;
  if (['p20', 'p21', 'p22', 'p24'].includes(x.k)) return ultimo(o, x.etapas) || null;
  return null;
}

export function faseTexto(f) { return f >= FASES.length ? 'Cerrado' : FASES[f]; }

// Dónde está el pedido en el flujograma, en palabras
export function ubicacion(S) {
  if (S.legado) return 'Entregado antes del seguimiento';
  if (S.cerrado) return `Paso ${TOTAL_PASOS} de ${TOTAL_PASOS} · cerrado`;
  return S.siguiente ? `Paso ${S.siguiente.n} de ${TOTAL_PASOS} · ${S.siguiente.nombre}` : '';
}

// Estado del pedido en palabras (equivale a los estados de la OP del flujograma)
export function estadoTexto(o, S) {
  if (S.legado) return 'Entregado (antes del seguimiento)';
  if (S.cerrado) return 'Cobrado · cerrado';
  if (o.estado === 'espera') return 'Por enviar la orden de producción';
  if (o.estado === 'entregado') return 'Entregado · por cobrar';
  return faseTexto(S.fase);
}
