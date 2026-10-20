// Costos: presupuesto (receta + mano de obra + indirectos) y costo real (salidas de material registradas).
import { POOLS, STAGE_POOL } from './motor.js';

export const COSTO_ROLES = ['direccion', 'jefa', 'admin'];
export const MATERIAL_ROLES = ['direccion', 'jefa', 'admin', 'compras'];
export const CATEGORIAS = ['Telas', 'Hilos', 'Avíos', 'Estampado', 'Empaque', 'Otros'];
export const UNIDADES = ['kg', 'm', 'unidad', 'cono', 'rollo', 'litro', 'par'];
export const CATEGORIAS_COSTO = { material: 'Material comprado aparte', mano_obra: 'Mano de obra extra', tercero: 'Servicio de terceros', transporte: 'Transporte y envío', otro: 'Otro' };
export const POR = { pieza: 'por pieza', ubicacion: 'por pieza y ubicación', color: 'por pieza, color y ubicación', pedido: 'por pedido' };

export const DEFAULT_COSTOS = {
  recetas: {},
  decoMateriales: { serigrafia: [], dtf: [], vinil: [], bordado: [] },
  bordadoExterno: { costoPieza: 0 },
  costoHora: { preprensa: 0, corte: 0, serigrafia: 0, costura: 0, bordado: 0, dtf: 0 },
  indirectosMes: 0,
  margen: 35,
  anticipo: 50,
  validezDias: 15,
  empresa: { nombre: 'INVERSIONES HAWAIIRA C.A.', rif: '', direccion: 'El Hatillo, Caracas, Venezuela', ciudad: 'Caracas, Venezuela', telefono: '', correo: '', proximaCotizacion: '', observaciones: 'CONTADO / LOS PRECIOS PUEDEN VARIAR AL DEFINIR LOS ARTES DEFINITIVOS', metodoPago: 'TRANSFERENCIA', leyendaIva: 'LOS PRECIOS NO INCLUYEN IVA' },
};

export const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function cfgCostos(data) {
  const d = data || {};
  return {
    ...DEFAULT_COSTOS, ...d,
    decoMateriales: { ...DEFAULT_COSTOS.decoMateriales, ...(d.decoMateriales || {}) },
    costoHora: { ...DEFAULT_COSTOS.costoHora, ...(d.costoHora || {}) },
    bordadoExterno: { ...DEFAULT_COSTOS.bordadoExterno, ...(d.bordadoExterno || {}) },
    empresa: { ...DEFAULT_COSTOS.empresa, ...(d.empresa || {}) },
  };
}

// Calculadora de costos. M = motor (tiempos y rutas), cc = configuración de costos, materiales = catálogo.
export function crearCostos({ M, cc, materiales = [] }) {
  const C = cfgCostos(cc);
  const mat = Object.fromEntries(materiales.map((m) => [m.id, m]));

  // Minutos productivos al mes de todo el taller (para repartir los gastos indirectos)
  const diasMes = M.cfg.sabado ? 26 : 22;
  const minMes = POOLS.reduce((a, p) => a + M.capDia(p), 0) * diasMes;
  const indirectoMin = minMes > 0 ? (+C.indirectosMes || 0) / minMes : 0;
  // Costo de un minuto productivo de cada estación (la hora pagada se divide entre la eficiencia real)
  const costoMin = (pool) => ((+C.costoHora[pool] || 0) / 60) / Math.max(0.1, (M.cfg.eficiencia || 85) / 100);

  function lineaMaterial(l, cantidad, o) {
    const m = mat[l.material];
    const d = o.deco || {}, col = Math.max(1, +d.colores || 1), ub = Math.max(1, +d.ubicaciones || 1);
    const mult = l.por === 'pedido' ? 1 : l.por === 'ubicacion' ? cantidad * ub : l.por === 'color' ? cantidad * ub * col : cantidad;
    const qty = (+l.consumo || 0) * (1 + (+l.merma || 0) / 100) * mult;
    return { material: m ? m.nombre : 'Material eliminado', unidad: m ? m.unidad : '', qty, costo: qty * (m ? +m.costo || 0 : 0), sinPrecio: !m || !(+m.costo > 0) };
  }

  // Presupuesto completo de un pedido (o de una línea de cotización con la misma forma)
  function presupuesto(o) {
    const q = +o.cantidad || 0;
    const receta = C.recetas[o.producto] || [];
    const tipo = (o.deco || {}).tipo || 'ninguna';
    const lineas = receta.map((l) => ({ ...lineaMaterial({ ...l, por: l.por || 'pieza' }, q, o), grupo: 'Prenda' }));
    if (tipo !== 'ninguna') (C.decoMateriales[tipo] || []).forEach((l) => lineas.push({ ...lineaMaterial(l, q, o), grupo: 'Estampado' }));
    const materiales = lineas.reduce((a, l) => a + l.costo, 0);

    let externo = 0;
    if (tipo === 'bordado' && (o.deco || {}).bordadoModo === 'externo') externo = (+C.bordadoExterno.costoPieza || 0) * q * Math.max(1, +(o.deco || {}).ubicaciones || 1);

    const mo = {}; let minutos = 0;
    M.ruta(o).forEach((s) => {
      if (M.externo(o, s)) return;
      const min = M.mpp(o, s) * (s === 'preprensa' ? 1 : q);
      minutos += min;
      const p = STAGE_POOL[s];
      mo[p] = (mo[p] || 0) + min * costoMin(p);
    });
    const manoObra = Object.values(mo).reduce((a, b) => a + b, 0);
    const indirectos = minutos * indirectoMin;
    const total = materiales + externo + manoObra + indirectos;
    const faltantes = [];
    if (!receta.length) faltantes.push('receta del producto');
    if (tipo !== 'ninguna' && !(C.decoMateriales[tipo] || []).length && !(tipo === 'bordado' && (o.deco || {}).bordadoModo === 'externo')) faltantes.push('materiales del estampado');
    if (lineas.some((l) => l.sinPrecio)) faltantes.push('precios de materiales');
    if (!Object.keys(mo).some((p) => +C.costoHora[p] > 0)) faltantes.push('costo de mano de obra');
    return { lineas, materiales, externo, mo, manoObra, minutos, indirectos, total, unitario: q ? total / q : 0, faltantes };
  }

  // Precio sugerido: el margen es sobre el precio de venta
  const precioSugerido = (costoUnit, margen = C.margen) => costoUnit / Math.max(0.05, 1 - (+margen || 0) / 100);

  // Costo real a la fecha: materiales que salieron del almacén + mano de obra de las piezas registradas + indirectos proporcionales
  // extras: costos adicionales cargados a mano (transporte, terceros, compras puntuales, horas extra…)
  function real(o, consumos, extras = []) {
    const mios = consumos.filter((c) => c.orden_id === o.id);
    const adicionales = extras.filter((x) => x.orden_id === o.id);
    const adicional = adicionales.reduce((a, x) => a + (+x.monto || 0), 0);
    const materiales = mios.reduce((a, c) => a + (+c.cantidad || 0) * (+c.costo_unit || 0), 0);
    let manoObra = 0, minutos = 0;
    M.ruta(o).forEach((s) => {
      if (M.externo(o, s)) return;
      const min = M.mpp(o, s) * M.doneOf(o, s);
      minutos += min;
      manoObra += min * costoMin(STAGE_POOL[s]);
    });
    const p = presupuesto(o);
    const avance = p.minutos > 0 ? minutos / p.minutos : 0;
    const externo = M.externo(o, 'bordado') ? p.externo * (M.doneOf(o, 'bordado') / Math.max(1, M.tot(o, 'bordado'))) : 0;
    const indirectos = minutos * indirectoMin;
    return { salidas: mios, materiales, manoObra, externo, indirectos, adicionales, adicional, total: materiales + manoObra + externo + indirectos + adicional, avance };
  }

  return { C, presupuesto, real, precioSugerido, costoMin, indirectoMin, minMes, mat };
}
