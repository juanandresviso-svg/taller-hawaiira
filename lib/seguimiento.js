// Seguimiento del flujo del pedido y exportación a Google Drive. SOLO servidor.
// 1) sincronizarHitos(): registra como hitos los pasos que la app detecta sola (OC, anticipo, producción, entrega…)
// 2) exportarDrive(): guarda los documentos de cada paso importante en la carpeta del pedido
//    y anota cada paso en la hoja "Seguimiento de pedidos" de Google Sheets.
// Las dos son seguras de llamar muchas veces: cada hito y cada documento tiene una clave única.
import { crearMotor, ordenDesdeDb } from './motor.js';
import { aprender } from './aprendizaje.js';
import { crearCostos, cfgCostos } from './costos.js';
import { PASO, DOCS, FASES, claveHito, claveHitoCot, hitosAutomaticos, pasosDe, estadoTexto, cotizacionDe, esLegado, ubicacion, OPCIONES_P15 } from './proceso.js';
import { googleConfigurado, crearDrive } from './drive.js';
import { sugerirEquipo, equiposDe } from './equipo.js';
import { nombreArchivo } from './formatoCotizacion.js';
import { htmlCotizacion, htmlOrdenProduccion, htmlNotaEntrega, htmlCierre, fechaHora } from './documentos.js';

const DIAS_ENTREGADOS = 120;        // pedidos entregados que se siguen revisando (por cobrar)
const MAX_INTENTOS = 5;
const hace = (ms) => new Date(Date.now() - ms).toISOString();
const ahoraIso = () => new Date().toISOString();

async function cargarBase(db) {
  const [cfg, ords, cots, hitos, perfiles, clis] = await Promise.all([
    db.from('config').select('data').eq('id', 1).single(),
    db.from('ordenes').select('*').or(`estado.in.(espera,activo),entregado.gte.${hace(DIAS_ENTREGADOS * 864e5)}`),
    db.from('cotizaciones').select('*'),
    db.from('hitos').select('*'),
    db.from('perfiles').select('id, nombre, rol, activo, estacion, email'),
    db.from('clientes').select('*'),
  ]);
  if (hitos.error) throw new Error('Falta correr las migraciones 06 y 07 en Supabase: ' + hitos.error.message);
  const ordenes = (ords.data || []).map(ordenDesdeDb);
  const M = crearMotor({ config: cfg.data?.data, ordenes: [], perfiles: perfiles.data || [] });
  return { cfg: cfg.data?.data, ordenes, filas: ords.data || [], cots: cots.data || [], hitos: hitos.data || [], perfiles: perfiles.data || [], clientes: clis.data || [], M };
}

// ---------- 1. Hitos automáticos ----------
const COT_DIAS = 60; // cotizaciones recientes que se siguen (más las de los pedidos en curso)
const hitosDeOrden = (B, id) => B.hitos.filter((h) => h.orden_id === id);
const hitosDeCot = (B, id) => (id ? B.hitos.filter((h) => h.cotizacion_id === id) : []);

export async function sincronizarHitos(db, { actor = null, base = null } = {}) {
  const B = base || (await cargarBase(db));
  const autoExist = B.hitos.filter((h) => h.auto);
  const sembrando = !autoExist.length; // primera vez: no se atribuye a nadie lo que ya estaba hecho
  const existe = new Set(B.hitos.map((h) => h.clave));
  const nuevos = [], quitar = [];
  const ahora = Date.now();
  const porQuien = (cuando) => (sembrando || !actor ? null : !cuando || ahora - new Date(cuando).getTime() < 15 * 60000 ? actor : null);
  const agregar = (clave, fila, x, quedan) => {
    quedan.add(clave);
    if (!existe.has(clave)) nuevos.push({ clave, ...fila, paso: x.paso, hecho: x.cuando || ahoraIso(), por: porQuien(x.cuando), nota: x.nota || '', auto: true });
  };

  // Pasos 1 a 8: en la cotización
  const cotsLigadas = new Set(B.ordenes.map((o) => o.cotizacionId).filter(Boolean));
  for (const c of B.cots.filter((x) => cotsLigadas.has(x.id) || ahora - new Date(x.creado).getTime() < COT_DIAS * 864e5)) {
    const quedan = new Set();
    hitosAutomaticos({ cot: c, M: B.M, hitos: hitosDeCot(B, c.id) }).forEach((x) => agregar(claveHitoCot(c.id, x.paso), { cotizacion_id: c.id }, x, quedan));
    autoExist.filter((h) => h.cotizacion_id === c.id && !quedan.has(h.clave)).forEach((h) => quitar.push(h.clave));
  }
  // Pasos 9 a 31: en cada pedido
  for (const o of B.ordenes) {
    const cot = cotizacionDe(o, B.cots);
    const quedan = new Set();
    hitosAutomaticos({ o, cot, M: B.M, hitos: [...hitosDeCot(B, cot && cot.id), ...hitosDeOrden(B, o.id)] }).forEach((x) => agregar(claveHito(o.id, x.paso), { orden_id: o.id }, x, quedan));
    autoExist.filter((h) => h.orden_id === o.id && !quedan.has(h.clave)).forEach((h) => quitar.push(h.clave));
  }

  if (nuevos.length) {
    const { error } = await db.from('hitos').upsert(nuevos, { onConflict: 'clave', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (quitar.length) await db.from('hitos').delete().in('clave', quitar).eq('auto', true);
  // La base queda al día para la exportación
  const quitados = new Set(quitar);
  B.hitos = B.hitos.filter((h) => !quitados.has(h.clave)).concat(nuevos.filter((n) => !existe.has(n.clave)));
  return { nuevos: nuevos.length, quitados: quitar.length, base: B };
}

// ---------- 2. Exportación a Google Drive ----------
export async function estadoDrive(db) {
  const { data } = await db.from('drive_cuenta').select('email, conectado, ultima_sync, ultimo_error, refresh_token').eq('id', 1).maybeSingle();
  return { configurado: googleConfigurado(), conectado: !!(data && data.refresh_token), email: data?.email || null, conectadoEl: data?.conectado || null, ultimaSync: data?.ultima_sync || null, ultimoError: data?.ultimo_error || null };
}

export async function exportarDrive(db, { base = null, limite = 5, soloOrden = null } = {}) {
  if (!googleConfigurado()) return { conectado: false, motivo: 'Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.' };
  const { data: cuenta } = await db.from('drive_cuenta').select('*').eq('id', 1).maybeSingle();
  if (!cuenta || !cuenta.refresh_token) return { conectado: false, motivo: 'La cuenta de Google no está conectada.' };
  const D = crearDrive(cuenta.refresh_token);
  const B = base || (await cargarBase(db));
  const { data: docsData, error: errDocs } = await db.from('documentos').select('clave, estado, drive_id, url, intentos, actualizado, orden_id');
  if (errDocs) throw new Error('Falta correr la migración 06 en Supabase: ' + errDocs.message);
  const docs = Object.fromEntries((docsData || []).map((d) => [d.clave, d]));
  const res = { conectado: true, documentos: 0, registros: 0, errores: [], pendientes: 0 };

  // Reclama una clave para trabajarla (evita que dos llamadas simultáneas creen el mismo archivo)
  async function reclamar(clave, extra = {}) {
    const d = docs[clave];
    if (!d) {
      const { data } = await db.from('documentos').upsert({ clave, ...extra, estado: 'pendiente' }, { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
      return !!(data && data.length);
    }
    if (d.estado === 'ok') return false;
    const espera = d.estado === 'pendiente' ? 10 * 60000 : Math.min(60, 2 ** d.intentos) * 60000;
    if (d.intentos >= MAX_INTENTOS && d.estado === 'error') return false;
    if (Date.now() - new Date(d.actualizado).getTime() < espera) return false;
    const { data } = await db.from('documentos').update({ estado: 'pendiente', actualizado: ahoraIso() }).eq('clave', clave).eq('actualizado', d.actualizado).select('clave');
    return !!(data && data.length);
  }
  async function listo(clave, f, extra = {}) {
    const fila = { estado: 'ok', drive_id: f.id, url: f.webViewLink || f.url || null, nombre: f.name || extra.nombre || '', error: null, actualizado: ahoraIso(), ...extra };
    await db.from('documentos').update(fila).eq('clave', clave);
    docs[clave] = { clave, ...fila };
  }
  async function fallo(clave, e) {
    const intentos = ((docs[clave] && docs[clave].intentos) || 0) + 1;
    await db.from('documentos').update({ estado: 'error', error: String(e.message || e).slice(0, 500), intentos, actualizado: ahoraIso() }).eq('clave', clave);
    res.errores.push(clave + ': ' + (e.message || e));
  }
  // Carpeta (la crea la primera vez). Si alguien la borró en Drive, se vuelve a crear.
  async function carpeta(clave, nombre, padre, extra = {}) {
    const d = docs[clave];
    if (d && d.estado === 'ok' && d.drive_id) return d.drive_id;
    if (!(await reclamar(clave, { tipo: 'carpeta', nombre, ...extra }))) return null;
    try { const f = await D.carpeta(nombre, padre); await listo(clave, f, { tipo: 'carpeta' }); return f.id; } catch (e) { await fallo(clave, e); throw e; }
  }

  try {
    await D.acceso();
  } catch (e) {
    await db.from('drive_cuenta').update({ ultimo_error: e.message }).eq('id', 1);
    return { ...res, conectado: !e.revocado, errores: [e.message] };
  }

  // Si borraron la carpeta principal en Drive (o se conectó otra cuenta), se vuelve a armar completa
  const raizDoc = docs['carpeta:raiz'];
  if (raizDoc && raizDoc.drive_id) {
    let inf = null;
    try { inf = await D.info(raizDoc.drive_id); } catch (e) { if (e.status !== 403) throw e; }
    if (!inf || inf.trashed) {
      await db.from('documentos').delete().neq('clave', '');
      Object.keys(docs).forEach((k) => delete docs[k]);
    }
  }

  const raiz = await carpeta('carpeta:raiz', 'Taller Hawaiira · Documentos', null);
  if (!raiz) return { ...res, pendientes: 1 };
  const nombre = (pid) => (B.perfiles.find((p) => p.id === pid) || {}).nombre || '';
  const cc = await db.from('costos_config').select('data').eq('id', 1).maybeSingle();
  const emp = cfgCostos(cc.data?.data).empresa;
  // Los pedidos entregados antes de activar el seguimiento no se exportan (salvo que luego se marque su cobro)
  const cobrados = new Set(B.hitos.filter((h) => h.paso === 'p29').map((h) => h.orden_id));
  const vigentes = B.ordenes.filter((o) => !esLegado(o) || cobrados.has(o.id));
  const porId = Object.fromEntries(vigentes.map((o) => [o.id, o]));
  const limpio = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
  let cambios = false;

  // Documentos que tocan según los pasos cumplidos
  const tareas = [];
  const cotsAprobadas = new Set(B.hitos.filter((h) => h.cotizacion_id && h.paso === 'p07').map((h) => h.cotizacion_id));
  B.hitos.forEach((h) => {
    if (h.cotizacion_id && h.paso === 'p06') tareas.push({ clave: `doc:cot:${h.cotizacion_id}`, cot: h.cotizacion_id });
    if (!h.orden_id || !porId[h.orden_id]) return;
    const p = PASO[h.paso];
    if (!p || !p.doc) return;
    const o = porId[h.orden_id];
    p.doc.forEach((d) => { if (d === 'oc' && !o.ocArchivo) return; tareas.push({ clave: `doc:op:${o.id}:${d}`, o, doc: d }); });
  });
  // La cotización aprobada también va a la carpeta de cada pedido que creó
  vigentes.forEach((o) => { const c = cotizacionDe(o, B.cots); if (c && (c.estado === 'aprobada' || cotsAprobadas.has(c.id))) tareas.push({ clave: `doc:op:${o.id}:cotizacion`, o, doc: 'cotizacion' }); });
  if (soloOrden) for (let i = tareas.length - 1; i >= 0; i--) if (!tareas[i].o || tareas[i].o.id !== soloOrden) tareas.splice(i, 1);
  const vistas = new Set();
  const porHacer = tareas.filter((t) => { if (vistas.has(t.clave)) return false; vistas.add(t.clave); const d = docs[t.clave]; return !d || d.estado !== 'ok'; });
  // Primero lo más reciente y lo que nunca falló
  porHacer.sort((a, b) => ((docs[a.clave]?.intentos || 0) - (docs[b.clave]?.intentos || 0)));

  let hechos = 0;
  let extras = null; // datos para los informes de cierre (se cargan una sola vez)
  for (const t of porHacer) {
    if (hechos >= limite) { res.pendientes++; continue; }
    try {
      if (t.cot) {
        const c = B.cots.find((x) => x.id === t.cot);
        if (!c) continue;
        const dir = await carpeta('carpeta:cotizaciones', 'Cotizaciones', raiz);
        if (!dir) { res.pendientes++; continue; }
        if (!(await reclamar(t.clave, { tipo: 'documento', cotizacion_id: c.id, nombre: `Cotización ${c.numero}` }))) continue;
        hechos++;
        try { const f = await D.pdfDesdeHtml({ nombre: limpio(nombreArchivo(c)), html: htmlCotizacion({ c, emp, cli: B.clientes.find((x) => x.id === c.cliente_id) || null, productos: (B.cfg || {}).productos || {} }), padre: dir }); await listo(t.clave, f); res.documentos++; cambios = true; } catch (e) { await fallo(t.clave, e); }
        continue;
      }
      const o = t.o;
      const pedidos = await carpeta('carpeta:pedidos', 'Pedidos', raiz);
      if (!pedidos) { res.pendientes++; continue; }
      const dir = await carpeta(`carpeta:op:${o.id}`, limpio(`${o.codigo} · ${o.cliente}`), pedidos, { orden_id: o.id });
      if (!dir) { res.pendientes++; continue; }
      const info = DOCS[t.doc];
      const titulo = limpio(`${info.n} ${info.nombre} ${t.doc === 'oc' && o.ocNumero ? o.ocNumero : t.doc === 'cotizacion' ? (cotizacionDe(o, B.cots) || {}).numero || '' : o.codigo}`);
      if (!(await reclamar(t.clave, { tipo: 'documento', orden_id: o.id, nombre: titulo }))) continue;
      hechos++;
      try {
        let f;
        const dueno = nombre(o.responsableId), cot = cotizacionDe(o, B.cots);
        if (t.doc === 'cotizacion') {
          if (!cot) throw new Error('No se encontró la cotización del pedido');
          f = await D.pdfDesdeHtml({ nombre: titulo, html: htmlCotizacion({ c: cot, emp, cli: B.clientes.find((x) => x.id === cot.cliente_id) || null, productos: (B.cfg || {}).productos || {} }), padre: dir });
        } else if (t.doc === 'oc') {
          const { data: blob, error } = await db.storage.from('ordenes-compra').download(o.ocArchivo);
          if (error) throw new Error('No se pudo leer la OC guardada: ' + error.message);
          const ext = (o.ocArchivo.split('.').pop() || 'pdf').toLowerCase();
          f = await D.subir({ nombre: `${titulo}.${ext}`, mime: blob.type || (ext === 'pdf' ? 'application/pdf' : 'image/' + ext), datos: Buffer.from(await blob.arrayBuffer()), padre: dir });
        } else if (t.doc === 'op') {
          const X = await cargarExtras();
          const equipo = sugerirEquipo(o, { M: X.Mplan, perfiles: B.perfiles, registros: X.registros, equipos: equiposDe(B.cfg) });
          f = await D.pdfDesdeHtml({ nombre: titulo, html: htmlOrdenProduccion({ o, M: X.M, emp, dueno, cot, equipo }), padre: dir });
        } else if (t.doc === 'entrega') {
          f = await D.pdfDesdeHtml({ nombre: titulo, html: htmlNotaEntrega({ o, M: B.M, emp, dueno }), padre: dir });
        } else if (t.doc === 'cierre') {
          const X = await cargarExtras();
          const [{ data: regs }, { data: cons }, { data: extras }] = await Promise.all([
            db.from('registros').select('*').eq('orden_id', o.id).order('ts'),
            db.from('consumos').select('*').eq('orden_id', o.id),
            db.from('costos_pedido').select('*').eq('orden_id', o.id),
          ]);
          f = await D.pdfDesdeHtml({ nombre: titulo, html: htmlCierre({ o, M: X.M, emp, dueno, regs: regs || [], hitos: [...hitosDeCot(B, o.cotizacionId), ...hitosDeOrden(B, o.id)], nombre, K: X.K, consumos: cons || [], extras: extras || [] }), padre: dir });
        }
        await listo(t.clave, f, { orden_id: o.id });
        res.documentos++; cambios = true;
      } catch (e) {
        if (e.status === 404) { await db.from('documentos').delete().eq('clave', `carpeta:op:${o.id}`); delete docs[`carpeta:op:${o.id}`]; }
        await fallo(t.clave, e);
      }
    } catch (e) {
      res.errores.push(t.clave + ': ' + e.message);
    }
  }

  async function cargarExtras() {
    if (extras) return extras;
    const [{ data: tiempos }, { data: mats }, { data: regs }] = await Promise.all([
      db.from('v_tiempos').select('*'), db.from('materiales').select('*'),
      db.from('registros').select('persona_id, cantidad, dia').gte('dia', new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10)),
    ]);
    const A = aprender(B.cfg, tiempos || []);
    const M = crearMotor({ config: A.efectivo, ordenes: [], perfiles: B.perfiles });
    const Mplan = crearMotor({ config: A.efectivo, ordenes: B.ordenes.filter((x) => x.estado === 'activo'), perfiles: B.perfiles });
    extras = { M, Mplan, registros: regs || [], K: crearCostos({ M, cc: cc.data?.data, materiales: mats || [] }) };
    return extras;
  }

  // ---------- Hoja "Seguimiento de pedidos" ----------
  try {
    let hoja = docs['hoja'];
    if (!hoja || hoja.estado !== 'ok') {
      if (await reclamar('hoja', { tipo: 'hoja', nombre: 'Seguimiento de pedidos' })) {
        try {
          const s = await D.crearHoja('Seguimiento de pedidos', ['Estado de pedidos', 'Bitácora'], raiz);
          await D.agregarFilas(s.id, 'Bitácora', [['Fecha', 'Pedido', 'Cliente', 'Fase', 'Paso', 'Responsable', 'Registrado por', 'Nota', 'Documento']]);
          await D.formatoEncabezado(s.id, 2);
          await listo('hoja', { id: s.id, webViewLink: s.url, name: 'Seguimiento de pedidos' }, { tipo: 'hoja' });
          hoja = docs['hoja']; cambios = true;
        } catch (e) { await fallo('hoja', e); }
      }
    }
    if (hoja && hoja.estado === 'ok') {
      // Bitácora: una fila por cada paso cumplido que aún no se anotó
      const atascado = (d) => d && d.estado !== 'ok' && Date.now() - new Date(d.actualizado).getTime() > 10 * 60000;
      const atascados = B.hitos.map((h) => 'log:' + h.clave).filter((k) => atascado(docs[k]));
      if (atascados.length) { await db.from('documentos').delete().in('clave', atascados); atascados.forEach((k) => delete docs[k]); }
      const sinAnotar = B.hitos.filter((h) => !docs['log:' + h.clave] && (h.cotizacion_id || porId[h.orden_id])).sort((a, b) => String(a.hecho).localeCompare(String(b.hecho))).slice(0, 300);
      if (sinAnotar.length) {
        const { data: reclamados } = await db.from('documentos').upsert(sinAnotar.map((h) => ({ clave: 'log:' + h.clave, tipo: 'registro', orden_id: h.orden_id || null, estado: 'pendiente' })), { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
        const mios = new Set((reclamados || []).map((x) => x.clave));
        const filas = [];
        const claves = [];
        sinAnotar.filter((h) => mios.has('log:' + h.clave)).forEach((h) => {
          const o = porId[h.orden_id], c = h.cotizacion_id ? B.cots.find((x) => x.id === h.cotizacion_id) : null;
          const p = PASO[h.paso] || { nombre: h.paso, fase: 0, cargo: '', n: '' };
          const docClave = o && p.doc ? `doc:op:${o.id}:${p.doc[p.doc.length - 1]}` : c && h.paso === 'p06' ? `doc:cot:${c.id}` : null;
          const doc = docClave && docs[docClave] && docs[docClave].estado === 'ok' ? docs[docClave].url : '';
          filas.push([fechaSheet(h.hecho), o ? o.codigo : c ? c.numero : '', o ? o.cliente : c ? c.cliente : '', FASES[p.fase], `${p.n} · ${p.nombre}`, p.cargo, nombre(h.por) || (h.auto ? 'Automático' : ''), h.paso === 'p15' ? OPCIONES_P15[h.nota] || h.nota : h.nota || '', doc || '']);
          claves.push('log:' + h.clave);
        });
        try {
          await D.agregarFilas(hoja.drive_id, 'Bitácora', filas);
          if (claves.length) await db.from('documentos').update({ estado: 'ok', actualizado: ahoraIso() }).in('clave', claves);
          res.registros += filas.length; cambios = cambios || filas.length > 0;
        } catch (e) {
          await db.from('documentos').delete().in('clave', claves);
          if (e.status === 404) await db.from('documentos').delete().eq('clave', 'hoja');
          res.errores.push('bitácora: ' + e.message);
        }
      }
      // Estado de pedidos: se reescribe completa cuando hubo cambios (o cada hora)
      const ultima = hoja.actualizado ? new Date(hoja.actualizado).getTime() : 0;
      if (cambios || Date.now() - ultima > 3600e3) {
        const enc = ['Pedido', 'Cliente', 'Producto', 'Cantidad', 'Dueño', 'Fecha comprometida', 'Estado', 'Paso del flujograma', 'Responsable del próximo paso', 'Pasos cumplidos', 'Monto US$', 'Monto OC US$', 'Unidades OC', 'Carpeta en Drive', 'Actualizado'];
        const filas = vigentes.slice().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))).map((o) => {
          const cot = cotizacionDe(o, B.cots);
          const S = pasosDe(o, { M: B.M, hitos: hitosDeOrden(B, o.id), hitosCot: hitosDeCot(B, cot && cot.id), cot });
          const car = docs[`carpeta:op:${o.id}`];
          return [o.codigo, o.cliente, B.M.prod(o).nombre, o.cantidad, nombre(o.responsableId), o.fechaCompromiso || '', estadoTexto(o, S), ubicacion(S), S.siguiente ? S.siguiente.cargo : '—', `${S.hechos} de ${S.aplican}`, o.monto || '', o.ocMonto ?? '', o.ocUnidades ?? '', car && car.estado === 'ok' ? car.url : '', fechaSheet(new Date())];
        });
        await D.reemplazarFilas(hoja.drive_id, 'Estado de pedidos', [enc, ...filas]);
        await db.from('documentos').update({ actualizado: ahoraIso() }).eq('clave', 'hoja');
      }
    }
  } catch (e) {
    res.errores.push('hoja: ' + e.message);
  }

  await db.from('drive_cuenta').update({ ultima_sync: ahoraIso(), ultimo_error: res.errores.length ? res.errores.slice(0, 3).join(' | ').slice(0, 500) : null }).eq('id', 1);
  return res;
}

function fechaSheet(d) {
  if (!d) return '';
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(d));
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

// Hitos + Drive en una sola pasada (lo usan /api/notificar, el cron diario y "Sincronizar ahora")
export async function seguimiento(db, { actor = null, limite = 5, soloOrden = null } = {}) {
  const h = await sincronizarHitos(db, { actor });
  let d = null;
  try { d = await exportarDrive(db, { base: h.base, limite, soloOrden }); } catch (e) { d = { error: e.message }; }
  return { hitos: { nuevos: h.nuevos, quitados: h.quitados }, drive: d };
}

export { fechaHora };

// Cliente de Drive de la cuenta conectada (o null)
export async function driveConectado(db) {
  if (!googleConfigurado()) return null;
  const { data } = await db.from('drive_cuenta').select('refresh_token').eq('id', 1).maybeSingle();
  return data && data.refresh_token ? crearDrive(data.refresh_token) : null;
}

// Datos para armar la orden de producción de un pedido (HTML con el equipo sugerido)
export async function datosOrdenProduccion(db, ordenId) {
  const B = await cargarBase(db);
  const o = B.ordenes.find((x) => x.id === ordenId);
  if (!o) return null;
  const [{ data: tiempos }, { data: regs }, cc] = await Promise.all([
    db.from('v_tiempos').select('*'),
    db.from('registros').select('persona_id, cantidad, dia').gte('dia', new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10)),
    db.from('costos_config').select('data').eq('id', 1).maybeSingle(),
  ]);
  const A = aprender(B.cfg, tiempos || []);
  const M = crearMotor({ config: A.efectivo, ordenes: [], perfiles: B.perfiles });
  const Mplan = crearMotor({ config: A.efectivo, ordenes: B.ordenes.filter((x) => x.estado === 'activo'), perfiles: B.perfiles });
  const equipo = sugerirEquipo(o, { M: Mplan, perfiles: B.perfiles, registros: regs || [], equipos: equiposDe(B.cfg) });
  const nombre = (pid) => (B.perfiles.find((p) => p.id === pid) || {}).nombre || '';
  const emp = cfgCostos(cc.data?.data).empresa;
  return { o, M, Mplan, equipo, emp, perfiles: B.perfiles, cot: cotizacionDe(o, B.cots), dueno: nombre(o.responsableId), html: htmlOrdenProduccion({ o, M, emp, dueno: nombre(o.responsableId), cot: cotizacionDe(o, B.cots), equipo }), status: Mplan.status[o.id] || null };
}
