// Motor de planificación: capacidad finita, fechas proyectadas, alertas y recomendaciones.
// Funciona igual en el navegador y en el servidor (resumen diario por correo).

export const POOLS = ['preprensa', 'corte', 'serigrafia', 'costura', 'dtf'];
export const POOL_NAME = { preprensa: 'Diseño y preprensa', corte: 'Corte', serigrafia: 'Serigrafía', costura: 'Costura', dtf: 'DTF, vinil y empaque' };
export const STAGE_NAME = { preprensa: 'Preprensa', corte: 'Corte', serigrafia: 'Serigrafía', costura: 'Costura', dtf: 'DTF / vinil', empaque: 'Empaque' };
export const STAGE_POOL = { preprensa: 'preprensa', corte: 'corte', serigrafia: 'serigrafia', costura: 'costura', dtf: 'dtf', empaque: 'dtf' };
export const DECO_NAME = { ninguna: 'Sin estampado', serigrafia: 'Serigrafía', dtf: 'DTF', vinil: 'Vinil' };
export const ROLES = { direccion: 'Dirección', jefa: 'Jefa de taller', admin: 'Administración', compras: 'Compras', diseno: 'Diseño', operador: 'Producción' };
export const ROLES_ALERTA = { direccion: 'Dirección', jefa: 'Jefa de taller', diseno: 'Diseño', compras: 'Compras', admin: 'Administración', duenos: 'Dueños de pedido' };
export const CHECK = {
  preprensa: ['Arte aprobado por el cliente (versión final)', 'Colores Pantone confirmados', 'Películas o archivo DTF a tamaño real', 'Posición y medida del estampado anotadas en la ficha'],
  corte: ['Revisar ficha técnica y cantidades por talla', 'Tela correcta: color, gramaje y lote', 'Respetar el sentido del hilo al tender', 'Anotar metros usados y merma', 'Armar paquetes por talla con su etiqueta'],
  serigrafia: ['Prueba de color aprobada antes de tirar', 'Registro de marcos alineado', 'Temperatura y tiempo de curado correctos', 'Separar piezas con defecto y anotarlas'],
  costura: ['Hilo del color indicado en la ficha', 'Puntadas por pulgada según estándar', 'Medir la primera pieza del paquete', 'Avisar a la jefa si falla una máquina'],
  dtf: ['Temperatura, presión y tiempo de la plancha', 'Posición según ficha (medir desde el cuello)', 'Prueba de pelado en la primera pieza', 'Contar piezas planchadas por talla'],
  empaque: ['Cortar hilos sueltos y revisar manchas', 'Verificar talla y etiqueta', 'Doblar y embolsar según el pedido', 'Contar por talla contra la orden', 'Separar segundas y anotarlas'],
};
export const DEFAULT_CFG = {
  horasDia: 8, eficiencia: 85, sabado: false, medidos: false,
  productos: {
    franela: { nombre: 'Franela', corte: 1.5, costura: 10, empaque: 0.8 },
    chemise: { nombre: 'Chemise', corte: 2.5, costura: 22, empaque: 1.2 },
    chaqueta: { nombre: 'Chaqueta', corte: 5, costura: 60, empaque: 2 },
  },
  deco: { serigrafiaColor: 0.8, dtfUbicacion: 1.2, prepBase: 60, prepColor: 30, prepDtf: 45 },
};

// ---------- Fechas (zona horaria de Caracas) ----------
export const nf = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 });
export const pct = (v) => nf.format(v * 100) + '%';
const fmtD = new Intl.DateTimeFormat('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Caracas' });
export function fd(d) { return d ? fmtD.format(d).replace(/\./g, '') : '—'; }
export function hoyCaracas() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parseDay(p);
}
export function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// Las fechas "de calendario" se guardan como mediodía para que no cambien de día con la zona horaria
export function parseDay(s) { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y + '-W' + String(w).padStart(2, '0'); }
export function mondayOf(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

// ---------- Datos: conversión fila de Supabase ↔ objeto de la app ----------
export function ordenDesdeDb(r) {
  return {
    id: r.id, codigo: r.codigo, cliente: r.cliente, responsableId: r.responsable_id, producto: r.producto,
    cantidad: r.cantidad, tallas: r.tallas || '', deco: r.deco || { tipo: 'ninguna', colores: 1, ubicaciones: 1 },
    fechaCompromiso: r.fecha_compromiso, monto: Number(r.monto) || 0, notas: r.notas || '',
    arteAprobado: r.arte_aprobado, materialListo: r.material_listo, anticipo: r.anticipo,
    estado: r.estado, prog: r.prog || {}, ultimo: r.ultimo || {}, creado: r.creado, entregado: r.entregado,
  };
}
export function ordenADb(o) {
  return {
    codigo: o.codigo, cliente: o.cliente, responsable_id: o.responsableId || null, producto: o.producto,
    cantidad: o.cantidad, tallas: o.tallas || '', deco: o.deco, fecha_compromiso: o.fechaCompromiso,
    monto: o.monto || 0, notas: o.notas || '', arte_aprobado: !!o.arteAprobado, material_listo: !!o.materialListo, anticipo: !!o.anticipo,
  };
}

// ---------- Motor ----------
export function crearMotor({ config, ordenes = [], perfiles = [], historial = {}, hoy = hoyCaracas() }) {
  const cfg = { ...DEFAULT_CFG, ...(config || {}), productos: { ...DEFAULT_CFG.productos, ...((config || {}).productos || {}) }, deco: { ...DEFAULT_CFG.deco, ...((config || {}).deco || {}) } };
  const equipo = perfiles.filter((p) => p.activo !== false);
  const t0 = hoy;

  const isWork = (d) => { const w = d.getDay(); if (w === 0) return false; if (w === 6) return !!cfg.sabado; return true; };
  const workdays = (n) => { const out = []; const d = new Date(t0); let g = 0; while (out.length < n && g < 1200) { if (isWork(d)) out.push(new Date(d)); d.setDate(d.getDate() + 1); g++; } return out; };
  const personas = (p) => equipo.filter((x) => x.estacion === p).length;
  const capDia = (p) => personas(p) * cfg.horasDia * 60 * (cfg.eficiencia / 100);
  const prod = (o) => cfg.productos[o.producto] || { nombre: o.producto || 'Producto', corte: 0, costura: 0, empaque: 0 };
  const ruta = (o) => { const t = (o.deco && o.deco.tipo) || 'ninguna', r = []; if (t !== 'ninguna') r.push('preprensa'); r.push('corte'); if (t === 'serigrafia') r.push('serigrafia'); r.push('costura'); if (t === 'dtf' || t === 'vinil') r.push('dtf'); r.push('empaque'); return r; };
  const tot = (o, s) => (s === 'preprensa' ? 1 : +o.cantidad || 0);
  const mpp = (o, s) => {
    const t = cfg.deco, d = o.deco || {}, P = prod(o), col = Math.max(1, +d.colores || 1), ub = Math.max(1, +d.ubicaciones || 1);
    switch (s) {
      case 'preprensa': return d.tipo === 'serigrafia' ? +t.prepBase + +t.prepColor * col * ub : +t.prepDtf * ub;
      case 'corte': return +P.corte || 0;
      case 'costura': return +P.costura || 0;
      case 'empaque': return +P.empaque || 0;
      case 'serigrafia': return +t.serigrafiaColor * col * ub;
      case 'dtf': return +t.dtfUbicacion * ub;
    }
    return 0;
  };
  const doneOf = (o, s) => Math.min(tot(o, s), +((o.prog || {})[s]) || 0);
  const deps = (o, s) => { const r = ruta(o); switch (s) { case 'serigrafia': return ['corte', 'preprensa']; case 'costura': return r.includes('serigrafia') ? ['serigrafia'] : ['corte']; case 'dtf': return ['costura', 'preprensa']; case 'empaque': return [r.includes('dtf') ? 'dtf' : 'costura']; } return []; };
  const upAvail = (o, s) => { let lim = tot(o, s); for (const dp of deps(o, s)) { if (!ruta(o).includes(dp)) continue; if (dp === 'preprensa') { if (doneOf(o, 'preprensa') < 1) lim = 0; } else lim = Math.min(lim, doneOf(o, dp)); } return Math.max(0, lim - doneOf(o, s)); };
  const curStage = (o) => ruta(o).find((s) => doneOf(o, s) < tot(o, s)) || null;
  const activos = ordenes.filter((o) => o.estado !== 'entregado');
  const nombreDe = (id) => (equipo.find((p) => p.id === id) || perfiles.find((p) => p.id === id) || {}).nombre || '';

  // Simulación día a día
  const days = workdays(260), cap = {};
  POOLS.forEach((p) => (cap[p] = capDia(p)));
  const act = activos.slice().sort((a, b) => (a.fechaCompromiso || '9').localeCompare(b.fechaCompromiso || '9') || (a.codigo || '').localeCompare(b.codigo || ''));
  const st = {}, hoyPlan = {};
  POOLS.forEach((p) => (hoyPlan[p] = []));
  let remaining = 0;
  act.forEach((o) => { const r = ruta(o), done = {}, fin = {}, start = {}; r.forEach((s) => { done[s] = doneOf(o, s); if (done[s] >= tot(o, s) - 1e-9) fin[s] = -1; else remaining++; }); st[o.id] = { r, done, fin, start }; });
  for (let d = 0; d < days.length && remaining > 0; d++) {
    const c = { ...cap };
    for (const o of act) {
      const x = st[o.id], snap = { ...x.done };
      for (const s of x.r) {
        if (x.fin[s] !== undefined) continue;
        const p = STAGE_POOL[s], T = tot(o, s), m = mpp(o, s);
        let lim = T;
        for (const dp of deps(o, s)) { if (!x.r.includes(dp)) continue; if (dp === 'preprensa') { if (snap.preprensa < 1) lim = 0; } else lim = Math.min(lim, snap[dp]); }
        const avail = lim - x.done[s];
        if (avail <= 1e-9) continue;
        if (m <= 0) { x.done[s] = lim; if (x.start[s] === undefined) x.start[s] = d; if (x.done[s] >= T - 1e-9) { x.fin[s] = d; remaining--; } continue; }
        if (c[p] <= 0.5) continue;
        const take = Math.min(avail * m, c[p]);
        c[p] -= take; x.done[s] += take / m;
        if (x.start[s] === undefined) x.start[s] = d;
        if (d === 0) hoyPlan[p].push({ oid: o.id, s, min: take, pzas: take / m });
        if (x.done[s] >= T - 1e-6) { x.fin[s] = d; remaining--; }
      }
    }
  }
  const idxOf = (date) => { let i = -1; for (let k = 0; k < days.length; k++) { if (days[k] <= date) i = k; else break; } return i; };
  const status = {};
  act.forEach((o) => {
    const x = st[o.id], fins = x.r.map((s) => x.fin[s]), listo = fins.every((f) => f === -1), unk = fins.some((f) => f === undefined);
    const end = unk ? null : Math.max(...fins), comp = parseDay(o.fechaCompromiso), ci = comp ? (comp < t0 ? -1 : idxOf(comp)) : 9999;
    let est, slack = null;
    if (listo) est = 'listo';
    else if (end === null) est = 'rojo';
    else { slack = ci - end; const margin = Math.max(1, Math.floor(0.2 * (ci + 1))); est = slack < 0 ? 'rojo' : slack <= margin ? 'amarillo' : 'verde'; }
    status[o.id] = { ...x, listo, end, endDate: end === null ? null : end < 0 ? t0 : days[end], comp, slack, est };
  });
  ordenes.filter((o) => o.estado === 'entregado').forEach((o) => (status[o.id] = { est: 'entregado', r: ruta(o) }));

  // Carga por estación
  const util = {};
  POOLS.forEach((p) => {
    const u = { total: 0, tarde: [] }, cp = cap[p];
    [5, 10, 20].forEach((w) => { const lim = days[w - 1]; let dem = 0; act.forEach((o) => { const comp = parseDay(o.fechaCompromiso); if (comp && comp <= lim) ruta(o).forEach((s) => { if (STAGE_POOL[s] === p) dem += (tot(o, s) - doneOf(o, s)) * mpp(o, s); }); }); u['w' + w] = { dem, cap: cp * w, u: cp > 0 ? dem / (cp * w) : dem > 0 ? 9 : 0 }; });
    let wsum = 0, msum = 0;
    act.forEach((o) => ruta(o).forEach((s) => { if (STAGE_POOL[s] !== p) return; const rem = tot(o, s) - doneOf(o, s), mm = rem * mpp(o, s); u.total += mm; if (s !== 'preprensa') { wsum += mm; msum += rem; } if (rem > 0 && status[o.id].est === 'rojo' && !u.tarde.includes(o.codigo)) u.tarde.push(o.codigo); }));
    u.avg = msum > 0 ? wsum / msum : 0;
    u.cola = cp > 0 ? u.total / cp : u.total > 0 ? Infinity : 0;
    if (p === 'dtf') { let a = 0, b = 0; act.forEach((o) => ruta(o).forEach((s) => { const mm = (tot(o, s) - doneOf(o, s)) * mpp(o, s); if (s === 'dtf') a += mm; if (s === 'empaque') b += mm; })); u.split = { dtf: a, empaque: b }; }
    util[p] = u;
  });

  const recurr = (p) => Object.keys(historial).sort().slice(-8).filter((k) => ((historial[k].util || {})[p] || 0) > 0.9).length;
  const workdaysBetween = (a, b) => { let n = 0; const d = new Date(a); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 1); while (d < b) { if (isWork(d)) n++; d.setDate(d.getDate() + 1); } return n; };

  // Alertas
  const alerts = [];
  act.forEach((o) => {
    const s = status[o.id], dueno = nombreDe(o.responsableId), who = dueno ? ` · Dueño: ${dueno}` : '', cs = curStage(o), r = ruta(o), base = { oid: o.id, dueno: o.responsableId };
    if (s.est === 'rojo') alerts.push({ ...base, sev: 'rojo', t: `${o.codigo} · ${o.cliente}: entrega en riesgo`, d: s.end === null ? 'Una estación sin personas asignadas impide terminar. Revisa el equipo en Usuarios.' : `Proyectada ${fd(s.endDate)}, comprometida ${fd(s.comp)} (${Math.abs(s.slack)} día${Math.abs(s.slack) === 1 ? '' : 's'} hábil${Math.abs(s.slack) === 1 ? '' : 'es'} tarde). Etapa actual: ${STAGE_NAME[cs] || '—'}${who}.`, para: ['direccion', 'jefa', 'duenos'] });
    else if (s.est === 'amarillo') alerts.push({ ...base, sev: 'amarillo', t: `${o.codigo} · ${o.cliente}: holgura mínima`, d: `Proyectada ${fd(s.endDate)}, comprometida ${fd(s.comp)}. Cualquier retraso en ${STAGE_NAME[cs] || '—'} la vuelve tarde${who}.`, para: ['jefa', 'duenos'] });
    else if (s.est === 'listo') alerts.push({ ...base, sev: 'info', t: `${o.codigo} · ${o.cliente}: listo para despachar`, d: `Coordina la entrega y la factura${who}.`, para: ['duenos', 'admin'] });
    if (r.includes('preprensa') && !o.arteAprobado && doneOf(o, 'preprensa') < 1) { const sp = s.start && s.start.preprensa; alerts.push({ ...base, sev: (sp != null && sp <= 1) || s.est === 'rojo' ? 'rojo' : 'amarillo', t: `${o.codigo}: arte sin aprobar`, d: `Sin arte aprobado no arranca la preprensa${sp != null ? ` (programada ${fd(days[sp])})` : ''}.`, para: ['diseno', 'duenos'] }); }
    if (!o.materialListo && doneOf(o, 'corte') < tot(o, 'corte')) { const sc = s.start && s.start.corte; alerts.push({ ...base, sev: sc != null && sc <= 2 ? 'rojo' : 'amarillo', t: `${o.codigo}: material no confirmado`, d: `El corte está programado para ${sc != null ? fd(days[sc]) : '—'}. Confirma tela y avíos en almacén.`, para: ['compras', 'jefa'] }); }
    if (!o.anticipo) alerts.push({ ...base, sev: 'info', t: `${o.codigo}: anticipo pendiente`, d: `${o.cliente} aún no paga el anticipo${who}.`, para: ['admin', 'duenos'] });
    r.forEach((sg) => { const dn = doneOf(o, sg), T = tot(o, sg); if (dn > 0 && dn < T) { const u = (o.ultimo || {})[sg], last = u ? new Date(u) : null; if (!last || workdaysBetween(last, t0) >= 2) alerts.push({ ...base, sev: 'amarillo', t: `${o.codigo}: ${STAGE_NAME[sg].toLowerCase()} sin avance`, d: `Sin registros desde ${last ? fd(last) : 'hace días'} con ${nf.format(dn)} de ${nf.format(T)} hechas.`, para: ['jefa'] }); } });
  });
  POOLS.forEach((p) => { const u = util[p]; if (personas(p) === 0) return; const v = u.w10.u; if (v > 1) alerts.push({ sev: 'rojo', t: `Cuello de botella: ${POOL_NAME[p]} al ${pct(v)}`, d: `En las próximas 2 semanas necesita ${nf.format(u.w10.dem / 60)} h y tiene ${nf.format(u.w10.cap / 60)} h. Mira las recomendaciones.`, para: ['direccion', 'jefa'] }); else if (v > 0.85) alerts.push({ sev: 'amarillo', t: `${POOL_NAME[p]} cerca del límite (${pct(v)})`, d: `Carga de 2 semanas al ${pct(v)} de su capacidad.`, para: ['direccion', 'jefa'] }); });
  const rank = { rojo: 0, amarillo: 1, info: 2 };
  alerts.sort((a, b) => rank[a.sev] - rank[b.sev]);

  // Recomendaciones
  const recs = [];
  const low = POOLS.filter((p) => personas(p) > 0).map((p) => ({ p, u: util[p].w10.u, spare: util[p].w10.cap - util[p].w10.dem })).sort((a, b) => a.u - b.u);
  POOLS.forEach((p) => {
    const u = util[p], n = personas(p), rec = recurr(p);
    if (n === 0) { if (u.total > 0) recs.push({ pool: p, nivel: 'estructural', titulo: `${POOL_NAME[p]} no tiene personas asignadas`, ops: ['Asigna al menos una persona a esta estación en Usuarios. Sin eso no se pueden proyectar fechas.'] }); return; }
    const u2 = u.w10.u, u4 = u.w20.u;
    if (u2 > 1) {
      const def = u.w10.dem - u.w10.cap, h = def / 60, hp = h / n / 10, sabH = n * cfg.horasDia * (cfg.eficiencia / 100), nsab = Math.max(1, Math.ceil(h / sabH)), ops = [];
      ops.push(`Horas extra: ${nf1.format(hp)} h diarias por persona durante 2 semanas (${nf.format(h)} h en total).`);
      if (!cfg.sabado) ops.push(`Trabajar ${nsab} sábado${nsab > 1 ? 's' : ''} con el equipo de ${POOL_NAME[p].toLowerCase()} (${nf.format(sabH)} h útiles cada uno).`);
      const donor = low.find((x) => x.p !== p && x.u < 0.7 && x.spare > 120);
      if (donor) ops.push(`Apoyo desde ${POOL_NAME[donor.p]} (al ${pct(donor.u)}): tiene unas ${nf.format(donor.spare / 60)} h libres en 2 semanas si hay alguien polivalente.`);
      if (u.avg > 0) ops.push(`Tercerizar unas ${nf.format(def / u.avg)} piezas de ${POOL_NAME[p].toLowerCase()} con un taller aliado.`);
      if (u.tarde.length) ops.push(`Reordenar prioridades o renegociar fecha de: ${u.tarde.join(', ')}.`);
      let nivel = 'temporal';
      if (rec >= 4 && u4 > 1.1) { nivel = 'estructural'; const need = Math.max(1, Math.ceil((u.w20.dem - u.w20.cap) / (cfg.horasDia * 60 * (cfg.eficiencia / 100) * 20))); ops.unshift(`Expansión: sumar ${need} persona${need > 1 ? 's' : ''} fija${need > 1 ? 's' : ''} o equipo equivalente. Lleva ${rec} de las últimas 8 semanas sobre 90%.`); }
      else if (rec >= 4) { nivel = 'recurrente'; ops.unshift(`Se repite (${rec} de 8 semanas sobre 90%): forma a una segunda persona o abre un segundo turno parcial.`); }
      recs.push({ pool: p, nivel, titulo: `${POOL_NAME[p]} al ${pct(u2)} en 2 semanas: faltan ${nf.format(h)} h`, ops });
    } else if (u2 > 0.85) {
      recs.push({ pool: p, nivel: 'aviso', titulo: `${POOL_NAME[p]} al ${pct(u2)} en 2 semanas`, ops: ['Cerca del límite: antes de aceptar pedidos con entrega en 2 semanas que usen esta estación, revisa la capacidad aquí.', rec >= 4 ? `Se repite (${rec} de 8 semanas): planifica una segunda persona.` : null].filter(Boolean) });
    }
    if (n === 1 && u.total > 0 && (u2 > 0.5 || p === 'corte' || p === 'dtf')) recs.push({ pool: p, nivel: 'riesgo', titulo: `${POOL_NAME[p]} depende de una sola persona`, ops: [`Si falta un día se pierden ${nf1.format(capDia(p) / 60)} h de capacidad${p === 'dtf' ? ' y se detienen DTF y empaque a la vez' : ''}. Capacita a un respaldo.`] });
  });
  const rrank = { estructural: 0, recurrente: 1, temporal: 2, aviso: 3, riesgo: 4 };
  recs.sort((a, b) => rrank[a.nivel] - rrank[b.nivel]);

  return { cfg, equipo, days, status, hoyPlan, util, alerts, recs, t0, isWork, personas, capDia, prod, ruta, tot, mpp, doneOf, deps, upAvail, curStage, activos, nombreDe, recurr, semanasHistorial: Object.keys(historial).length };
}
