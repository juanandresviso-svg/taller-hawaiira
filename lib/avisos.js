// Tipos de notificación (las personas pueden apagar los que no quieran)
export const TIPOS_AVISO = {
  pedidos: { nombre: 'Pedidos', detalle: 'Nuevo pedido, pedido activado con la orden de compra, listo para despachar y entregado.' },
  cotizaciones: { nombre: 'Cotizaciones', detalle: 'Cuando una cotización se aprueba o se rechaza.' },
  alertas: { nombre: 'Alertas en rojo', detalle: 'Pedido que se va tarde, material sin confirmar cerca del corte, nuevo cuello de botella y pedido entregado sin cobrar.' },
  produccion: { nombre: 'Producción', detalle: 'Cada vez que un pedido termina una etapa (corte, costura, estampado…).' },
  almacen: { nombre: 'Almacén', detalle: 'Cuando un material se queda sin stock.' },
};

// Qué roles reciben cada tipo (Dirección recibe todo; el dueño del pedido recibe lo de sus pedidos)
export const ROLES_AVISO = {
  pedidos: ['jefa', 'compras', 'admin'],
  cotizaciones: ['admin'],
  alertas: ['jefa', 'compras'],
  produccion: ['jefa'],
  almacen: ['compras'],
};
// Los operadores no reciben avisos: su lista de trabajo está en "Mi trabajo"
export const RECIBE_AVISOS = (rol) => rol && rol !== 'operador';

// Pide al servidor que revise si hay novedades que avisar (no bloquea ni muestra errores)
export function revisarNovedades() {
  try {
    fetch('/api/notificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {});
  } catch {}
}
