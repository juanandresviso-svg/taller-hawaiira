// Notificaciones push (llegan aunque la app esté cerrada). SOLO servidor.
// revisarYAvisar() mira el estado actual del taller, detecta novedades que aún no se avisaron
// y las envía a las personas que corresponden según su rol. Es seguro llamarla muchas veces:
// cada novedad tiene una clave única en avisos_enviados y se avisa una sola vez.
import webpush from 'web-push';
import { crearMotor, ordenDesdeDb, POOLS, POOL_NAME, STAGE_NAME, fd, parseDay, nf, pct } from './motor.js';
import { aprender } from './aprendizaje.js';
import { ROLES_AVISO, RECIBE_AVISOS } from './avisos.js';
import { SEGUIMIENTO_DESDE } from './proceso.js';

const REARMAN = ['tarde:', 'material:', 'cuello:', 'stock:']; // se pueden repetir cuando la situación se resuelve y vuelve a pasar
const RECIENTE = 3 * 864e5;
const COBRO_DIAS = 3; // días después de entregado sin cobrar para avisar a Administración

export function pushConfigurado() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
let listo = false;
function prepararVapid() {
  if (listo || !pushConfigurado()) return listo;
  const sujeto = process.env.VAPID_SUBJECT || (process.env.GMAIL_USER ? 'mailto:' + process.env.GMAIL_USER : 'mailto:taller@example.com');
  webpush.setVapidDetails(sujeto, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  listo = true;
  return true;
}

// Envía un aviso a una lista de perfiles (todas sus suscripciones). Borra las suscripciones vencidas.
export async function enviarA(db, perfilIds, aviso) {
  if (!perfilIds.length || !prepararVapid()) return 0;
  const { data: subs } = await db.from('suscripciones_push').select('*').in('perfil_id', perfilIds);
  let n = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 86400, urgency: aviso.urgente ? 'high' : 'normal' });
      n++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('suscripciones_push').delete().eq('endpoint', s.endpoint);
      else console.error('push', e.statusCode, e.body || e.message);
    }
  }));
  return n;
}

export async function revisarYAvisar(db, { actor = null } = {}) {
  const ahora = Date.now();
  const desde = new Date(ahora - RECIENTE).toISOString();
  const [cfg, ords, entr, perfiles, hist, tiempos, cots, mats, prefs, cuenta, porCobrar, cobrados, sols, ...previas] = await Promise.all([
    db.from('config').select('data').eq('id', 1).single(),
    db.from('ordenes').select('*').in('estado', ['espera', 'activo']),
    db.from('ordenes').select('*').eq('estado', 'entregado').gte('entregado', desde),
    db.from('perfiles').select('*'),
    db.from('historial').select('*'),
    db.from('v_tiempos').select('*'),
    db.from('cotizaciones').select('id, numero, cliente, estado, total, creado_por, ordenes').in('estado', ['aprobada', 'rechazada']),
    db.from('materiales').select('*'),
    db.from('avisos_pref').select('*'),
    db.from('avisos_enviados').select('clave', { count: 'exact', head: true }),
    db.from('ordenes').select('id, codigo, cliente, monto, responsable_id, entregado').eq('estado', 'entregado').gte('entregado', new Date(Math.max(ahora - 120 * 864e5, Date.parse(SEGUIMIENTO_DESDE))).toISOString()).lte('entregado', new Date(ahora - COBRO_DIAS * 864e5).toISOString()),
    db.from('hitos').select('orden_id').eq('paso', 'cobro'),
    db.from('solicitudes').select('id, numero, cliente, estado, items, vendedor_id, creado, actualizado').in('estado', ['nueva', 'cotizada', 'aprobada', 'rechazada']).gte('actualizado', desde),
    ...REARMAN.map((p) => db.from('avisos_enviados').select('clave').like('clave', p + '%')),
  ]);
  if (cuenta.error) throw new Error('Falta correr la migración 04 en Supabase: ' + cuenta.error.message);
  const sembrar = !cuenta.count; // primera vez: registra lo que ya existe sin avisar, para no inundar a nadie

  const historial = Object.fromEntries((hist.data || []).map((h) => [h.semana, h]));
  const A = aprender(cfg.data?.data, tiempos.data || []);
  const crudas = ords.data || [];
  const activas = crudas.filter((r) => r.estado === 'activo').map(ordenDesdeDb);
  const M = crearMotor({ config: A.efectivo, ordenes: activas, perfiles: perfiles.data || [], historial });
  const nombreProd = (k) => (M.cfg.productos[k] || {}).nombre || k;
  const reciente = (ts) => ts && ahora - new Date(ts).getTime() < RECIENTE;

  const ev = []; // { clave, tipo, roles, dueno, extra, aviso }
  const add = (clave, tipo, aviso, { roles = ROLES_AVISO[tipo], dueno = null, extra = [] } = {}) => ev.push({ clave, tipo, roles, dueno, extra, aviso });
  const url = '/?tab=pedidos';

  // Pedidos: nuevos y activados con la OC
  crudas.forEach((r) => {
    const linea = `${r.cliente} · ${nombreProd(r.producto)} × ${nf.format(r.cantidad)} · entrega ${fd(parseDay(r.fecha_compromiso))}`;
    if (reciente(r.creado)) {
      if (r.estado === 'espera') add('nuevo:' + r.id, 'pedidos', { title: `Nuevo pedido ${r.codigo} · falta enviar la orden de producción`, body: linea + '. Entra en el plan al enviar la orden de producción.', url }, { roles: ['admin'], dueno: r.responsable_id });
      else add('nuevo:' + r.id, 'pedidos', { title: `Nuevo pedido ${r.codigo}`, body: linea, url }, { dueno: r.responsable_id });
    }
    if (r.estado === 'activo' && !r.op_enviada && reciente(r.activado) && r.creado && new Date(r.activado) - new Date(r.creado) > 120000)
      add('activado:' + r.id, 'pedidos', { title: `${r.codigo} activado${r.oc_numero ? ' · OC ' + r.oc_numero : ''}`, body: `Llegó la orden de compra: ${linea}. Ya entra en el plan del taller.`, url }, { dueno: r.responsable_id });
  });
  (entr.data || []).forEach((r) => add(`entregado:${r.id}:${r.entregado}`, 'pedidos', { title: `${r.codigo} entregado`, body: `${r.cliente} · ${nombreProd(r.producto)} × ${nf.format(r.cantidad)}. Sus tiempos ya cuentan en los tiempos de producción.`, url }, { roles: ['admin'], dueno: r.responsable_id }));

  // Producción: etapas terminadas y pedidos listos para despachar
  activas.forEach((o) => {
    const s = M.status[o.id] || {}, r = M.ruta(o);
    if (s.listo) { add('listo:' + o.id, 'pedidos', { title: `${o.codigo} listo para despachar`, body: `${o.cliente} · ${M.prod(o).nombre} × ${nf.format(o.cantidad)}. Coordina la entrega y la factura.`, url }, { roles: ['admin', 'jefa'], dueno: o.responsableId }); return; }
    r.forEach((sg, i) => {
      const T = M.tot(o, sg);
      if (T > 0 && M.doneOf(o, sg) >= T) {
        const sig = r.slice(i + 1).find((x) => M.doneOf(o, x) < M.tot(o, x));
        add(`etapa:${o.id}:${sg}`, 'produccion', { title: `${o.codigo}: ${STAGE_NAME[sg].toLowerCase()} terminado`, body: `${o.cliente} · ${nf.format(o.cantidad)} pzas${sig ? ` · sigue ${STAGE_NAME[sig].toLowerCase()}` : ''}.`, url: '/?tab=taller' }, { dueno: o.responsableId });
      }
    });
  });

  // Alertas en rojo
  M.alerts.filter((a) => a.sev === 'rojo').forEach((a) => {
    const o = activas.find((x) => x.id === a.oid);
    if (!o) return;
    if (/entrega en riesgo/.test(a.t)) add('tarde:' + o.id, 'alertas', { title: `En rojo: ${o.codigo} se va tarde`, body: `${o.cliente}. ${a.d}`, url: '/?tab=tablero', urgente: true }, { dueno: o.responsableId });
    else if (/material no confirmado/.test(a.t)) add('material:' + o.id, 'alertas', { title: `En rojo: material de ${o.codigo} sin confirmar`, body: a.d, url: '/?tab=tablero', urgente: true }, { dueno: o.responsableId });
  });
  POOLS.forEach((p) => {
    const v = M.util[p].w10.u;
    if (M.personas(p) > 0 && v > 1) add('cuello:' + p, 'alertas', { title: `Cuello de botella: ${POOL_NAME[p]} al ${pct(v)}`, body: `En las próximas 2 semanas necesita ${nf.format(M.util[p].w10.dem / 60)} h y tiene ${nf.format(M.util[p].w10.cap / 60)} h. Revisa las recomendaciones en el Tablero.`, url: '/?tab=tablero', urgente: true }, { roles: ['jefa'] });
  });

  // Entregados sin cobrar (paso "Saldo cobrado" del flujo). Si aún no se corrió la migración 06, no se avisa.
  if (!cobrados.error) {
    const cob = new Set((cobrados.data || []).map((x) => x.orden_id));
    (porCobrar.data || []).filter((r) => !cob.has(r.id)).forEach((r) => add('cobro:' + r.id, 'alertas', {
      title: `${r.codigo} entregado y sin cobrar`,
      body: `${r.cliente}${+r.monto ? ' · US$ ' + nf.format(+r.monto) : ''}. Entregado el ${fd(new Date(r.entregado))}. Factura y cobra el saldo, y márcalo en el seguimiento del pedido.`,
      url,
    }, { roles: ['admin'], dueno: r.responsable_id }));
  }

  // Cotizaciones
  (cots.data || []).forEach((c) => add(`cot:${c.id}:${c.estado}`, 'cotizaciones', {
    title: `Cotización ${c.numero} ${c.estado}`,
    body: c.estado === 'aprobada' ? `${c.cliente} aprobó. ${(c.ordenes || []).length ? 'Pedidos creados: ' + c.ordenes.join(', ') + '.' : ''}` : `${c.cliente} no aceptó la cotización.`,
    url: '/?tab=costos',
  }, { extra: c.creado_por ? [c.creado_por] : [] }));

  // Solicitudes de clientes (si aún no se corrió la migración 11, no se avisa)
  if (!sols.error) (sols.data || []).forEach((s) => {
    const que = (s.items || []).map((i) => `${nombreProd(i.producto)} × ${nf.format(+i.cantidad || 0)}`).join(', ');
    if (s.estado === 'nueva') add('sol:' + s.id, 'solicitudes', { title: `Nueva solicitud ${s.numero} · ${s.cliente}`, body: (que || 'Sin productos') + '. Pásala a cotizar en Solicitudes.', url: '/?tab=solicitudes' });
    else add(`sol:${s.id}:${s.estado}`, 'solicitudes', {
      title: `Solicitud ${s.numero} ${s.estado === 'cotizada' ? 'cotizada' : s.estado}`,
      body: s.estado === 'cotizada' ? `${s.cliente}: la cotización está lista para enviar al cliente.` : s.estado === 'aprobada' ? `${s.cliente} aprobó la cotización.` : `${s.cliente} no aceptó la cotización.`,
      url: '/?tab=solicitudes',
    }, { roles: [], dueno: s.vendedor_id });
  });

  // Almacén: materiales sin stock
  (mats.data || []).filter((m) => m.activo !== false && m.maneja_stock && +m.stock <= 0).forEach((m) =>
    add('stock:' + m.id, 'almacen', { title: `Sin stock: ${m.nombre}`, body: `Quedan ${nf.format(+m.stock || 0)} ${m.unidad}. Haz la reposición.`, url: '/?tab=materiales' }));

  // Las situaciones que se resolvieron se pueden volver a avisar si regresan
  const actuales = new Set(ev.map((e) => e.clave));
  const resueltas = previas.flatMap((q) => (q.data || []).map((x) => x.clave)).filter((k) => !actuales.has(k));
  if (resueltas.length) await db.from('avisos_enviados').delete().in('clave', resueltas);

  if (!ev.length && !sembrar) return { enviados: 0, nuevos: 0 };
  const filas = ev.map((e) => ({ clave: e.clave }));
  if (sembrar) filas.push({ clave: 'inicio' });
  const { data: nuevas, error } = await db.from('avisos_enviados').upsert(filas, { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
  if (error) throw error;
  if (sembrar) return { enviados: 0, nuevos: 0, sembrado: filas.length };
  const nuevasSet = new Set((nuevas || []).map((x) => x.clave));

  const apagados = Object.fromEntries((prefs.data || []).map((p) => [p.perfil_id, p.apagados || []]));
  const gente = (perfiles.data || []).filter((p) => p.activo !== false && RECIBE_AVISOS(p.rol));
  let enviados = 0;
  for (const e of ev.filter((x) => nuevasSet.has(x.clave))) {
    const ids = gente.filter((p) => p.id !== actor && !(apagados[p.id] || []).includes(e.tipo)
      && (p.rol === 'direccion' || e.roles.includes(p.rol) || p.id === e.dueno || e.extra.includes(p.id))).map((p) => p.id);
    enviados += await enviarA(db, ids, { ...e.aviso, tag: e.clave, tipo: e.tipo });
  }
  return { enviados, nuevos: nuevasSet.size };
}
