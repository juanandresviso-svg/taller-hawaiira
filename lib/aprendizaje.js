// Los tiempos de producción son un RESULTADO, no un dato que se escribe.
// Cada pedido marcado como ENTREGADO aporta sus minutos reales por pieza (medidos en los registros).
// Para cada producto y etapa se usa el promedio de los últimos 6 pedidos entregados, ponderado por piezas
// y sin las mediciones extremas. Mientras no haya ningún pedido entregado, la app usa un estimado inicial.
import { DEFAULT_CFG } from './motor.js';

export const ETAPAS_PROD = ['corte', 'costura', 'empaque'];
export const CAMPOS_DECO = {
  serigrafiaColor: { etapa: 'serigrafia', tipo: ['serigrafia'], unidades: (d) => Math.max(1, +d.colores || 1) * Math.max(1, +d.ubicaciones || 1), nombre: 'Serigrafía · por pieza, color y ubicación' },
  dtfUbicacion: { etapa: 'dtf', tipo: ['dtf', 'vinil'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), nombre: 'DTF o vinil · por pieza y ubicación' },
  bordadoUbicacion: { etapa: 'bordado', tipo: ['bordado'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), interno: true, nombre: 'Bordado interno · por pieza y ubicación' },
};
// Preprensa: minutos por pedido, por unidad de trabajo (color×ubicación en serigrafía, ubicación en el resto)
export const CAMPOS_PREP = {
  prepColor: { tipo: ['serigrafia'], unidades: (d) => Math.max(1, +d.colores || 1) * Math.max(1, +d.ubicaciones || 1), nombre: 'Preprensa serigrafía · por color y ubicación' },
  prepDtf: { tipo: ['dtf', 'vinil'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), nombre: 'Preprensa DTF o vinil · por ubicación' },
  prepBordado: { tipo: ['bordado'], unidades: (d) => Math.max(1, +d.ubicaciones || 1), nombre: 'Ponchado de bordado · por ubicación' },
};
const MIN_PIEZAS = 10;

export function cfgBase(config) {
  const c = config || {};
  return { ...DEFAULT_CFG, horaInicio: '07:30', almuerzoInicio: '12:00', almuerzoMin: 60, ...c,
    productos: { ...DEFAULT_CFG.productos, ...(c.productos || {}) }, deco: { ...DEFAULT_CFG.deco, ...(c.deco || {}) } };
}

// muestras: [{valor (min por unidad), peso, hasta, codigo}]
function resumir(muestras) {
  const ult = muestras.filter((m) => m.valor > 0 && Number.isFinite(m.valor)).sort((a, b) => String(b.hasta).localeCompare(String(a.hasta))).slice(0, 6);
  if (!ult.length) return null;
  const orden = ult.map((m) => m.valor).sort((a, b) => a - b);
  const med = orden[Math.floor(orden.length / 2)];
  const ok = ult.filter((m) => m.valor >= med / 2.5 && m.valor <= med * 2.5);
  const peso = ok.reduce((a, m) => a + m.peso, 0);
  if (!peso) return null;
  return {
    real: Math.round((ok.reduce((a, m) => a + m.valor * m.peso, 0) / peso) * 100) / 100,
    n: ok.length, piezas: peso, descartadas: ult.length - ok.length,
    ultimo: { valor: ult[0].valor, codigo: ult[0].codigo }, pedidos: ok.map((m) => m.codigo),
  };
}

// filas: vista v_tiempos. Devuelve la configuración efectiva (la que usa la app) y el detalle de cada tiempo.
export function aprender(config, filas = []) {
  const base = cfgBase(config);
  const efectivo = structuredClone(base);
  const detalle = { productos: {}, deco: {}, prep: {} };
  const entregados = filas.filter((f) => f.estado === 'entregado' && +f.minutos > 0 && +f.piezas_med > 0);

  Object.entries(base.productos).forEach(([k, p]) => {
    detalle.productos[k] = {};
    ETAPAS_PROD.forEach((s) => {
      const r = resumir(entregados.filter((f) => f.producto === k && f.etapa === s && f.piezas_med >= MIN_PIEZAS)
        .map((f) => ({ valor: f.minutos / f.piezas_med, peso: +f.piezas_med, hasta: f.hasta, codigo: f.codigo })));
      const inicial = +p[s] || 0;
      detalle.productos[k][s] = { inicial, ...(r || {}), usado: r ? r.real : inicial, fuente: r ? 'real' : 'estimado' };
      if (r) efectivo.productos[k][s] = r.real;
    });
  });

  Object.entries(CAMPOS_DECO).forEach(([campo, def]) => {
    const r = resumir(entregados.filter((f) => f.etapa === def.etapa && f.piezas_med >= MIN_PIEZAS && def.tipo.includes((f.deco || {}).tipo) && (!def.interno || (f.deco || {}).bordadoModo !== 'externo'))
      .map((f) => ({ valor: f.minutos / (f.piezas_med * def.unidades(f.deco || {})), peso: +f.piezas_med, hasta: f.hasta, codigo: f.codigo })));
    const inicial = +base.deco[campo] || 0;
    detalle.deco[campo] = { inicial, ...(r || {}), usado: r ? r.real : inicial, fuente: r ? 'real' : 'estimado', nombre: def.nombre };
    if (r) efectivo.deco[campo] = r.real;
  });

  Object.entries(CAMPOS_PREP).forEach(([campo, def]) => {
    const r = resumir(entregados.filter((f) => f.etapa === 'preprensa' && def.tipo.includes((f.deco || {}).tipo))
      .map((f) => ({ valor: f.minutos / def.unidades(f.deco || {}), peso: 1, hasta: f.hasta, codigo: f.codigo })));
    // Estimado inicial expresado por unidad (en serigrafía incluye la base repartida en un color)
    const inicial = campo === 'prepColor' ? (+base.deco.prepBase || 0) + (+base.deco.prepColor || 0) : +base.deco[campo] || 0;
    detalle.prep[campo] = { inicial, ...(r || {}), usado: r ? r.real : inicial, fuente: r ? 'real' : 'estimado', nombre: def.nombre };
    if (r) { efectivo.deco[campo] = r.real; if (campo === 'prepColor') efectivo.deco.prepBase = 0; }
  });

  return { efectivo, detalle, entregados: new Set(entregados.map((f) => f.orden_id)).size };
}

// Estimado para un producto nuevo: el promedio de los productos que ya tienen tiempos reales (o de todos si aún no hay)
export function estimarProducto(cfgEfectivo, detalle) {
  const claves = Object.keys(cfgEfectivo.productos);
  const conReal = detalle ? claves.filter((k) => ETAPAS_PROD.some((s) => detalle.productos[k] && detalle.productos[k][s] && detalle.productos[k][s].fuente === 'real')) : [];
  const lista = (conReal.length ? conReal : claves.filter((k) => !cfgEfectivo.productos[k].estimado)).map((k) => cfgEfectivo.productos[k]);
  const usar = lista.length ? lista : Object.values(cfgEfectivo.productos);
  const prom = (k) => Math.round((usar.reduce((a, p) => a + (+p[k] || 0), 0) / Math.max(1, usar.length)) * 10) / 10;
  return { corte: prom('corte'), costura: prom('costura'), empaque: prom('empaque') };
}
