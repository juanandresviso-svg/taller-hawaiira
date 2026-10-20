// Formato de cotización de Hawaiira Studio (el mismo de las cotizaciones en Google Sheets: "P279 Cliente - HAWAIIRA STUDIO")
export const LEYENDA_IVA = 'LOS PRECIOS NO INCLUYEN IVA';
export const OBSERVACIONES_BASE = 'CONTADO / LOS PRECIOS PUEDEN VARIAR AL DEFINIR LOS ARTES DEFINITIVOS';
export const PAGO_BASE = 'TRANSFERENCIA';
const CODIGOS = { franela: 'FR01', chemise: 'CH01', chaqueta: 'CQ01' };

// Código del producto en la cotización (FR01, CH01…): el guardado en el producto, uno conocido o dos letras + 01
export function codigoProducto(clave, productos = {}) {
  const p = productos[clave] || {};
  if (p.codigo) return p.codigo;
  if (CODIGOS[clave]) return CODIGOS[clave];
  const base = String(p.nombre || clave || 'PR').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'PR';
  return base + '01';
}

// Próximo número: sigue la numeración del taller (279, 280…), o el número inicial de Datos de la empresa
export function numeroSiguiente(numeros = [], inicial) {
  const max = numeros.reduce((m, n) => { const v = parseInt(String(n || '').replace(/\D/g, ''), 10); return v > m ? v : m; }, 0);
  return String(Math.max(max + 1, parseInt(inicial, 10) || 1));
}

export const fechaCorta = (d) => (d ? new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Caracas' }).format(new Date(d)) : '');
export const montoNum = (v) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(+v || 0);
// Nombre del archivo PDF: "P279 ANA GARCIA SRL - HAWAIIRA STUDIO"
export const nombreArchivo = (c) => `P${String(c.numero || '').replace(/\D/g, '') || c.numero} ${String(c.cliente || '').toUpperCase()} - HAWAIIRA STUDIO`.replace(/[\\/:*?"<>|]/g, '-');
