// Nota de entrega con el formato de Hawaiira Studio (el de Word: "NOTA DE ENTREGA 114 DARKSIDE")
import { codigoProducto } from './formatoCotizacion.js';

function decoTexto(d) {
  const t = d.tipo === 'serigrafia' ? 'serigrafía' : d.tipo === 'bordado' ? 'bordado' : d.tipo === 'dtf' ? 'DTF' : d.tipo === 'vinil' ? 'vinil' : d.tipo;
  return t;
}

export const OBS_NOTA = 'POR PAGAR';
export const GRACIAS_NOTA = 'Le(s) damos las gracias por su confianza en nuestro servicio.';

// Línea de la cotización de la que salió el pedido (por posición del código o por producto)
function lineaCot(o, cot) {
  if (!cot || !Array.isArray(cot.items)) return null;
  const i = (cot.ordenes || []).indexOf(o.codigo);
  if (i >= 0 && cot.items[i]) return cot.items[i];
  return cot.items.find((x) => x.producto === o.producto) || null;
}

// Filas de la nota: código, descripción y cantidad de cada pedido
export function lineasNota(ordenes, { productos = {}, cots = [] } = {}) {
  return ordenes.map((o) => {
    const cot = o.cotizacionId ? cots.find((c) => c.id === o.cotizacionId) : null;
    const it = lineaCot(o, cot);
    const nombre = (productos[o.producto] || {}).nombre || o.producto;
    const desc = (it && (it.descripcion || it.nombre)) || [nombre, o.deco && o.deco.tipo !== 'ninguna' ? decoTexto(o.deco) : ''].filter(Boolean).join(' · ');
    return { codigo: (it && it.codigo) || codigoProducto(o.producto, productos), descripcion: String(desc).toUpperCase(), cantidad: +o.cantidad || 0, op: o.codigo };
  });
}

// Lo que va en el renglón "Pedido": las órdenes de compra del cliente o, si no hay, los códigos OP
export function referenciaPedido(ordenes) {
  const oc = [...new Set(ordenes.map((o) => o.ocNumero).filter(Boolean))];
  return oc.length ? oc.join(', ') : ordenes.map((o) => o.codigo).join(', ');
}

// Nombre del archivo PDF: "NOTA DE ENTREGA 115 DARKSIDE"
export const nombreArchivoNota = (n, cliente) => `NOTA DE ENTREGA ${n} ${String(cliente || '').toUpperCase()}`.replace(/[\\/:*?"<>|]/g, '-').trim();
