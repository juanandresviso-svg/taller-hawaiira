// Aprende los tiempos reales de producción a partir de los registros y ajusta los tiempos estándar.
// Cada pedido terminado (o con suficiente avance) aporta una medición; se usan las 6 más recientes,
// se descartan las extremas y se mezcla con el tiempo configurado según cuántas piezas respaldan el dato.
import { DEFAULT_CFG } from './motor.js';

const ETAPAS_PROD = ['corte', 'costura', 'empaque'];
export const CAMPOS_DECO = {
  serigrafiaColor: { etapa: 'serigrafia', tipo: ['serigrafia'], unidades: (d) => Math.max(1, +d.colores || 1) * Math.max(1, +d.ubicaciones || 1), nombre: 'Serigrafía (por color y ubicación)' },
  dtfUbicacion: { etapa: 'dtf', tipo: ['dtf', 'vinil'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), nombre: 'DTF o vinil (por ubicación)' },
  bordadoUbicacion: { etapa: 'bordado', tipo: ['bordado'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), interno: true, nombre: 'Bordado interno (por ubicación)' },
};
const MIN_PIEZAS = 10;

export function cfgBase(config) {
  const c = config || {};
  return { ...DEFAULT_CFG, horaInicio: '07:30', almuerzoInicio: '12:00', almuerzoMin: 60, aprendizaje: true, ...c,
    productos: { ...DEFAULT_CFG.productos, ...(c.productos || {}) }, deco: { ...DEFAULT_CFG.deco, ...(c.deco || {}) } };
}

// muestras: [{valor (min por unidad), peso (piezas), hasta}]
function resumir(muestras) {
  const ult = muestras.filter((m) => m.valor > 0 && Number.isFinite(m.valor)).sort((a, b) => String(b.hasta).localeCompare(String(a.hasta))).slice(0, 6);
  if (!ult.length) return null;
  const orden = ult.map((m) => m.valor).sort((a, b) => a - b);
  const med = orden[Math.floor(orden.length / 2)];
  const ok = ult.filter((m) => m.valor >= med / 2.5 && m.valor <= med * 2.5);
  const peso = ok.reduce((a, m) => a + m.peso, 0);
  if (!peso) return null;
  return { real: ok.reduce((a, m) => a + m.valor * m.peso, 0) / peso, n: ok.length, piezas: peso, descartadas: ult.length - ok.length };
}

const mezclar = (conf, r, piezasPlenas) => {
  if (!r) return { usado: conf, w: 0 };
  const w = Math.min(1, r.piezas / piezasPlenas);
  return { usado: Math.round((w * r.real + (1 - w) * conf) * 100) / 100, w };
};

// filas: vista v_tiempos. Devuelve la configuración efectiva (la que usa la app para planificar) y el detalle por producto.
export function aprender(config, filas = []) {
  const base = cfgBase(config);
  const efectivo = structuredClone(base);
  const detalle = { productos: {}, deco: {} };
  const validas = filas.filter((f) => f.minutos > 0 && f.piezas_med > 0);

  Object.entries(base.productos).forEach(([k, p]) => {
    detalle.productos[k] = {};
    ETAPAS_PROD.forEach((s) => {
      const muestras = validas.filter((f) => f.producto === k && f.etapa === s && f.piezas_med >= MIN_PIEZAS)
        .map((f) => ({ valor: f.minutos / f.piezas_med, peso: f.piezas_med, hasta: f.hasta }));
      const r = resumir(muestras);
      const conf = +p[s] || 0;
      const m = mezclar(conf, r, p.estimado ? 50 : 200);
      detalle.productos[k][s] = { conf, ...(r || {}), ...m, estimado: !!p.estimado };
      if (base.aprendizaje !== false) efectivo.productos[k][s] = m.usado;
    });
  });

  Object.entries(CAMPOS_DECO).forEach(([campo, def]) => {
    const muestras = validas.filter((f) => f.etapa === def.etapa && f.piezas_med >= MIN_PIEZAS && def.tipo.includes((f.deco || {}).tipo) && (!def.interno || (f.deco || {}).bordadoModo !== 'externo'))
      .map((f) => ({ valor: f.minutos / (f.piezas_med * def.unidades(f.deco || {})), peso: f.piezas_med, hasta: f.hasta }));
    const r = resumir(muestras);
    const conf = +base.deco[campo] || 0;
    const m = mezclar(conf, r, 200);
    detalle.deco[campo] = { conf, ...(r || {}), ...m, nombre: def.nombre };
    if (base.aprendizaje !== false) efectivo.deco[campo] = m.usado;
  });

  return { efectivo, detalle };
}

// Tiempos para un producto nuevo: el promedio de los productos que ya tienen tiempos confiables
export function estimarProducto(cfgEfectivo) {
  const ps = Object.values(cfgEfectivo.productos).filter((p) => !p.estimado);
  const lista = ps.length ? ps : Object.values(cfgEfectivo.productos);
  const prom = (k) => Math.round((lista.reduce((a, p) => a + (+p[k] || 0), 0) / Math.max(1, lista.length)) * 10) / 10;
  return { corte: prom('corte'), costura: prom('costura'), empaque: prom('empaque') };
}
