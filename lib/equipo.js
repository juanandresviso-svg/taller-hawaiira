// Equipo sugerido para un pedido: personas de cada estación y máquinas de cada etapa.
// Lo usan la app (al enviar la orden de producción y en el seguimiento) y el PDF de la orden de producción.
import { STAGE_POOL, STAGE_NAME, POOL_NAME, isoDay, hoyCaracas } from './motor.js';

export const ETAPAS = ['preprensa', 'corte', 'serigrafia', 'costura', 'bordado', 'dtf', 'empaque'];

// Máquinas de ejemplo: se ajustan en Ajustes → Equipos y máquinas.
// para: vacío = sirve para todo; si no, productos (clave) o estampados ('deco:serigrafia', 'deco:dtf'…)
export const EQUIPOS_BASE = [
  { id: 'pc-diseno', nombre: 'Computador de diseño', etapa: 'preprensa', cantidad: 1 },
  { id: 'insoladora', nombre: 'Insoladora y revelado de marcos', etapa: 'preprensa', cantidad: 1, para: ['deco:serigrafia'] },
  { id: 'mesa-corte', nombre: 'Mesa de corte', etapa: 'corte', cantidad: 1 },
  { id: 'cortadora', nombre: 'Cortadora vertical', etapa: 'corte', cantidad: 1 },
  { id: 'pulpo', nombre: 'Pulpo de serigrafía', etapa: 'serigrafia', cantidad: 1 },
  { id: 'horno', nombre: 'Horno o túnel de curado', etapa: 'serigrafia', cantidad: 1 },
  { id: 'overlock', nombre: 'Overlock (fileteadora)', etapa: 'costura', cantidad: 2 },
  { id: 'recta', nombre: 'Máquina recta', etapa: 'costura', cantidad: 2, para: ['chemise', 'chaqueta'] },
  { id: 'collaretera', nombre: 'Collaretera (recubridora)', etapa: 'costura', cantidad: 1, para: ['franela', 'chemise'] },
  { id: 'ojaladora', nombre: 'Ojaladora y botonera', etapa: 'costura', cantidad: 1, para: ['chemise'] },
  { id: 'bordadora', nombre: 'Bordadora', etapa: 'bordado', cantidad: 1 },
  { id: 'plancha', nombre: 'Plancha térmica', etapa: 'dtf', cantidad: 1 },
  { id: 'plotter', nombre: 'Plotter de corte de vinil', etapa: 'dtf', cantidad: 1, para: ['deco:vinil'] },
  { id: 'mesa-empaque', nombre: 'Mesa de revisión y empaque', etapa: 'empaque', cantidad: 1 },
];

export const equiposDe = (config) => (config && Array.isArray(config.equipos) ? config.equipos : EQUIPOS_BASE);

function sirve(eq, o) {
  const para = eq.para || [];
  if (!para.length) return true;
  const tipo = (o.deco && o.deco.tipo) || 'ninguna';
  return para.some((t) => t === o.producto || t === 'deco:' + tipo);
}

// Sugerencia por etapa. M debe incluir el pedido en su plan para tener fechas.
// registros: registros de producción recientes (para repartir entre quienes tienen menos carga)
export function sugerirEquipo(o, { M, perfiles = [], registros = [], equipos = EQUIPOS_BASE }) {
  const st = M.status[o.id] || {};
  const desde = isoDay(new Date(hoyCaracas().getTime() - 6 * 864e5));
  const carga = {};
  registros.filter((r) => r.dia >= desde).forEach((r) => { carga[r.persona_id] = (carga[r.persona_id] || 0) + (+r.cantidad || 0); });
  return M.ruta(o).map((s) => {
    const pool = STAGE_POOL[s];
    const maquinas = equipos.filter((e) => e.etapa === s && (+e.cantidad || 0) > 0 && sirve(e, o)).map((e) => ({ nombre: e.nombre, cantidad: +e.cantidad || 1 }));
    if (M.externo(o, s)) return { etapa: s, nombre: STAGE_NAME[s], estacion: 'Taller aliado', externo: true, personas: [], maquinas: [], necesarias: 0, disponibles: 0 };
    const restante = Math.max(0, M.tot(o, s) - M.doneOf(o, s));
    const minutos = restante * M.mpp(o, s);
    const ini = st.start ? st.start[s] : null, fin = st.fin ? st.fin[s] : null;
    const dias = ini != null && fin != null && fin >= ini && ini >= 0 ? fin - ini + 1 : 1;
    const gente = perfiles.filter((p) => p.activo !== false && p.estacion === pool);
    const porPersona = gente.length ? M.capDia(pool) / gente.length : 0;
    const necesarias = !restante ? 0 : porPersona > 0 ? Math.min(gente.length, Math.max(1, Math.ceil(minutos / (dias * porPersona)))) : 0;
    const elegidas = gente.slice().sort((a, b) => (carga[a.id] || 0) - (carga[b.id] || 0) || String(a.nombre).localeCompare(String(b.nombre))).slice(0, necesarias);
    return {
      etapa: s, nombre: STAGE_NAME[s], estacion: POOL_NAME[pool], hecho: restante === 0,
      inicio: ini != null && ini >= 0 && M.days[ini] ? M.days[ini] : null, fin: fin != null && fin >= 0 && M.days[fin] ? M.days[fin] : null,
      horas: minutos / 60, necesarias, disponibles: gente.length, personas: elegidas.map((p) => p.nombre), maquinas,
    };
  });
}
