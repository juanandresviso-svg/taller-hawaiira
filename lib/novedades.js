// Novedades de cada versión. La más reciente va primero: es la que se muestra al actualizar.
// Para cada publicación nueva, agrega una entrada arriba con un id distinto.
export const NOVEDADES = [
  {
    id: '2026-10-20-solicitudes',
    fecha: '20 oct 2026',
    titulo: 'Solicitudes de clientes antes de la cotización',
    puntos: [
      'Pestaña nueva Solicitudes y cargo nuevo Ventas: Ventas registra lo que pide el cliente y Administración lo cotiza.',
      '"Cotizar" abre la cotización con el cliente y los productos de la solicitud. La solicitud muestra su cotización, el estado y los pedidos.',
      'Las cotizaciones parten de una solicitud. Solo Dirección puede hacer una cotización sin solicitud.',
    ],
  },
  {
    id: '2026-10-20-lista-precios',
    fecha: '20 oct 2026',
    titulo: 'Materiales como lista de precios',
    puntos: [
      'Materiales ahora es una lista de precios. El stock solo se lleva en lo que marques "Almacén".',
      'En Pedidos → Materiales eliges el material, pones la cantidad y la app calcula el total. Si lo pagaste a otro precio, lo cambias y se actualiza la lista.',
    ],
  },
  {
    id: '2026-10-20-costos-pedido',
    fecha: '20 oct 2026',
    titulo: 'Editar costos de los pedidos y cotización antes de la orden de producción',
    puntos: [
      'Costos → Costo por pedido: toca un pedido para cambiar la venta, corregir o agregar salidas de material y agregar costos adicionales (transporte, terceros, compras, horas extra).',
      'En Pedidos, cada pedido nuevo pide primero "Generar cotización" y después "Enviar orden de producción".',
    ],
  },
  {
    id: '2026-10-20-formato-cotizacion',
    fecha: '20 oct 2026',
    titulo: 'Cotizaciones con el formato de Hawaiira Studio',
    puntos: [
      'Botón "Generar cotización": abre la cotización con el formato del taller (código, descripción, cantidad, precio unitario y total, observaciones y métodos de pago) lista para descargar en PDF.',
      'La numeración sigue la del taller (280, 281…) y el cliente trae su contacto, RIF, dirección y teléfono.',
    ],
  },
  {
    id: '2026-10-20-clientes-oc-trazabilidad',
    fecha: '20 oct 2026',
    titulo: 'Clientes, lectura de la orden de compra y trazabilidad de los 31 pasos',
    puntos: [
      'Pestaña Clientes: cada pedido y cotización queda ligado a su cliente, con pedidos, unidades, vendido, por cobrar, tasa de aprobación y puntualidad.',
      'La app lee la orden de compra del cliente (PDF o foto): número, unidades, monto a pagar y fecha de entrega. Revisas, completas a mano y compara con el pedido.',
      'Nuevo pedido desde la OC y botón "Enviar orden de producción": entra en el plan, se guarda en PDF en Drive y se avisa al taller por notificación, correo y WhatsApp.',
      'Equipo sugerido para cada pedido: personas de cada estación y máquinas de cada etapa (se ajustan en Ajustes → Equipos y máquinas).',
      'Trazabilidad completa: los 31 pasos del flujograma, con el paso en que va cada pedido, responsable, fecha y documentos.',
    ],
  },
  {
    id: '2026-10-20-seguimiento-drive',
    fecha: '20 oct 2026',
    titulo: 'Seguimiento del flujo del pedido y documentos en Google Drive',
    puntos: [
      'Cada pedido muestra en qué fase va (cotización, aprobación, compras, producción, entrega y cobro) y cuál es el próximo paso. Pulsa "Seguimiento" para ver todos los pasos con su responsable, fecha y quién lo hizo.',
      'Nuevos pasos que marca cada responsable: control de calidad (jefe de taller), saldo facturado y saldo cobrado (Administración).',
      'En el Tablero, "Flujo de pedidos" muestra cuántos pedidos hay en cada fase y los pasos que le tocan a cada cargo. En Pedidos, el filtro "Por cobrar".',
      'Con Google Drive conectado, la app guarda sola la cotización, la orden de compra, la orden de producción, la nota de entrega y el informe de cierre en la carpeta de cada pedido, y anota cada paso en la hoja "Seguimiento de pedidos".',
    ],
  },
  {
    id: '2026-10-20-enlaces',
    fecha: '20 oct 2026',
    titulo: 'Enlaces de invitación por rol',
    puntos: [
      'En Usuarios, Dirección crea un enlace distinto para cada rol y estación (o todos de una vez con "Crear un enlace para cada rol").',
      'Quien abre el enlace escribe su nombre, correo y contraseña, y entra directo con su rol.',
      'Cada enlace puede vencer, tener un máximo de registros y desactivarse en cualquier momento. Se comparte con un toque por WhatsApp.',
      'Dirección recibe una notificación con cada registro nuevo.',
    ],
  },
  {
    id: '2026-10-20-notificaciones-oc',
    fecha: '20 oct 2026',
    titulo: 'Notificaciones del taller y orden de compra del cliente',
    puntos: [
      'Botón "Notificaciones" arriba: actívalas en cada dispositivo y te llegan aunque la app esté cerrada.',
      'Avisan de pedidos nuevos, activados, listos y entregados; cotizaciones aprobadas o rechazadas; alertas en rojo; etapas terminadas y materiales sin stock. Eliges qué tipos recibir.',
      'Los pedidos se activan al subir la orden de compra (OC) del cliente. Sin OC quedan "por activar" y no entran en el plan del taller.',
      'Al aprobar una cotización puedes adjuntar la OC para que los pedidos queden activos de una vez.',
      'La app avisa cuando hay una versión nueva, y los productos se pueden renombrar en Ajustes.',
    ],
  },
  {
    id: '2026-10-20-avisos',
    fecha: '20 oct 2026',
    titulo: 'Avisos de actualización y cambio de nombre de productos',
    puntos: [
      'Cuando se publique una versión nueva, la app te avisa abajo a la derecha con el botón "Actualizar ahora".',
      'Después de actualizar verás aquí qué cambió.',
      'Puedes activar los avisos de escritorio para enterarte aunque la app esté en segundo plano.',
      'Ahora se puede cambiar el nombre de un producto en Ajustes → Tiempos de producción.',
    ],
  },
  {
    id: '2026-10-20-tiempos',
    fecha: '20 oct 2026',
    titulo: 'Tiempos de producción reales e informe de producción',
    puntos: [
      'Los minutos por pieza ya no se escriben: salen de los pedidos entregados.',
      'Botón "Empezar" en Mi trabajo para medir el tiempo de cada paquete.',
      'Cada pedido tiene su Informe de producción con tiempos reales, quién trabajó y costos.',
    ],
  },
  {
    id: '2026-10-19-costos',
    fecha: '19 oct 2026',
    titulo: 'Costos, materiales, cotizaciones y bordado',
    puntos: [
      'Pestaña Costos: costo por pedido, cotizaciones en PDF, materiales, recetas y mano de obra.',
      'Bordado interno o con taller aliado.',
      'Agregar productos nuevos desde el pedido y registrar salidas de material.',
    ],
  },
];
