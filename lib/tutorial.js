// Pasos del tutorial guiado según el rol. `sel` apunta a un elemento con data-tour="…"; `tab` cambia de pestaña.

const BIENVENIDA = (nombre) => ({
  titulo: `Hola, ${nombre}`,
  texto: 'Este recorrido de 2 minutos te muestra cómo se usa la app del taller. Puedes saltarlo y volver a verlo cuando quieras con el botón "Tutorial", arriba a la derecha.',
});
const FIN = {
  sel: 'ayuda',
  titulo: 'Listo',
  texto: 'Cuando tengas dudas, vuelve a abrir el tutorial desde aquí. Consejo: instala la app en tu computadora o teléfono (en Chrome o Edge, ícono "Instalar" en la barra de direcciones) para abrirla con un toque.',
};

const PRODUCCION = [
  { tab: 'taller', sel: 'plan', titulo: 'Tu plan de hoy', texto: 'Aquí aparecen los pedidos que tu estación debe trabajar hoy, en orden de prioridad. El primero es el más urgente.' },
  { tab: 'taller', sel: 'tarea', titulo: 'Cada pedido', texto: 'Ves el código, el cliente, las tallas, la fecha de entrega y un semáforo: verde va a tiempo, amarillo va justo y rojo va tarde. La barra muestra cuántas piezas van hechas.' },
  { tab: 'taller', sel: 'meta', titulo: 'Meta de hoy', texto: 'Es la cantidad de piezas que te toca hacer hoy para que el pedido llegue a tiempo.' },
  { tab: 'taller', sel: 'recordatorios', titulo: 'Recordatorios', texto: 'Ábrelos antes de empezar y márcalos: son los puntos que no se pueden olvidar en tu etapa (ficha técnica, color de hilo, temperatura…).' },
  { tab: 'taller', sel: 'empezar', titulo: 'Empezar', texto: 'Pulsa Empezar cuando arranques un pedido. Al registrar, la app guarda cuánto tardaste y sigue contando el siguiente paquete. Cuando el pedido se entrega, esos tiempos reales pasan a ser los tiempos de producción de la app.' },
  { tab: 'taller', sel: 'registrar', titulo: 'Registrar lo que terminaste', texto: 'Cada vez que termines un paquete, escribe las piezas (o usa +10 y +25) y pulsa Registrar. Si te equivocas, pulsa "Deshacer" en el aviso que aparece abajo; tienes 30 minutos.' },
];

export function pasosTutorial(perfil) {
  const nombre = (perfil.nombre || '').split(' ')[0] || 'equipo';
  const rol = perfil.rol;

  if (rol === 'operador') {
    return [
      BIENVENIDA(nombre),
      ...PRODUCCION,
      { tab: 'taller', sel: 'viene', titulo: 'Lo que viene', texto: 'Debajo ves los pedidos que llegarán a tu estación en los próximos días.' },
      { sel: 'salir', titulo: 'Tableta compartida', texto: 'Si usas una tableta del taller, pulsa Salir al terminar tu turno, para que lo que registre la siguiente persona quede a su nombre.' },
      FIN,
    ];
  }

  const gestion = ['direccion', 'jefa'].includes(rol);
  const pasos = [
    BIENVENIDA(nombre),
    { sel: 'pestanas', titulo: 'Las pestañas', texto: gestion
      ? 'Tablero para ver el estado del taller, Pedidos para cargarlos y seguirlos, Mi trabajo para el plan del día de cada estación y Ajustes para los tiempos y la capacidad.'
      : 'Tablero para ver el estado del taller y tus alertas, Pedidos para crearlos y seguirlos, y Mi trabajo para ver el plan del día.' },
    { tab: 'tablero', sel: 'resumen', titulo: 'Resumen', texto: 'Pedidos activos, cuántos van en riesgo o justos, cuántos están listos para despachar y cuál es la estación más cargada.' },
    { tab: 'tablero', sel: 'alertas', titulo: 'Alertas', texto: gestion
      ? 'Todo lo que necesita atención hoy: entregas en riesgo, material o arte pendientes, etapas sin avance y cuellos de botella. Usa los botones para filtrar por responsable.'
      : 'Lo que necesita atención hoy. Pulsa "Mis pedidos" o el botón de tu área para ver solo lo tuyo. Cada mañana también te llegan por correo.' },
    { tab: 'tablero', sel: 'flujo', titulo: 'Flujo de pedidos', texto: 'Cuántos pedidos hay en cada fase del flujo, de la cotización al cobro, y debajo los pasos que le tocan a tu cargo (anticipos, arte, material, control de calidad, facturas y cobros).' },
  ];
  if (gestion) {
    pasos.push(
      { tab: 'tablero', sel: 'carga', titulo: 'Carga por estación', texto: 'Cuánto trabajo tiene cada estación frente a su capacidad en las próximas 2 semanas. Más de 85% es amarillo y más de 100% es rojo: ahí está el cuello de botella.' },
      { tab: 'tablero', sel: 'recomendaciones', titulo: 'Recomendaciones', texto: 'Cuando una estación se satura, la app propone qué hacer con números: horas extra, sábados, apoyo desde otra estación, tercerizar o contratar.' },
    );
  }
  pasos.push(
    { tab: 'pedidos', sel: 'importar', titulo: 'Importar pedidos', texto: 'Para cargar varios pedidos de una vez: descarga la plantilla de Excel, llena una fila por pedido (con el avance que ya llevan) y súbela aquí.' },
    { tab: 'pedidos', sel: 'nuevo-pedido', titulo: 'Nuevo pedido', texto: 'Para cargar un pedido suelto: cliente, producto, cantidad, estampado y fecha prometida. La app calcula sola cuándo estará listo según la carga real.' },
    { tab: 'pedidos', sel: 'desde-oc', titulo: 'Nuevo pedido desde la OC', texto: 'Sube el PDF o la foto de la orden de compra del cliente: la app lee el número de OC, las unidades, el monto a pagar y la fecha de entrega. Revisas lo leído, completas a mano lo que falte y se crea el pedido con esos datos.' },
    { tab: 'pedidos', sel: 'nuevo-pedido', titulo: 'Enviar la orden de producción', texto: 'Un pedido nuevo o salido de una cotización aprobada entra en el plan del taller cuando pulsas "Enviar orden de producción". Ahí se lee y revisa la OC, ves el equipo sugerido (personas y máquinas por etapa) y se avisa al taller por notificación, correo con el PDF y WhatsApp.' },
    { tab: 'pedidos', sel: 'pedido', titulo: 'Seguir un pedido', texto: 'Las barras muestran cada etapa (la del borde negro es la actual). Compara la fecha comprometida con la proyectada y marca Arte aprobado, Material listo y Anticipo cuando corresponda.' },
    { tab: 'pedidos', sel: 'seguimiento', titulo: 'Trazabilidad del flujograma', texto: 'Cada pedido dice en qué paso del flujograma va (por ejemplo "paso 14 de 31") y quién es el responsable. Pulsa "Trazabilidad" para ver los 31 pasos con fecha, quién lo hizo y los documentos en Google Drive, marcar los pasos de tu cargo y ver el equipo sugerido.' },
  );
  if (gestion) {
    pasos.push(
      { tab: 'taller', sel: 'plan', titulo: 'Plan de cada estación', texto: 'En Mi trabajo ves lo que cada estación debe hacer hoy, con la meta en piezas. Es la lista para repartir el trabajo al empezar el día.' },
      { tab: 'taller', sel: 'recientes', titulo: 'Corregir registros', texto: 'Aquí ves los últimos registros de producción de todos. Si alguien se equivocó, pulsa Deshacer en esa línea.' },
      { tab: 'ajustes', sel: 'capacidad', titulo: 'Capacidad', texto: 'Horas por día, eficiencia real y si se trabaja los sábados. Con esto y las personas de cada estación se calcula la capacidad.' },
      { tab: 'ajustes', sel: 'tiempos', titulo: 'Tiempos de producción', texto: 'Los minutos por pieza no se escriben: son el resultado de los pedidos entregados. Cada vez que se marca un pedido como entregado, sus tiempos reales entran al promedio y la app planifica con ellos.' },
    );
  } else {
    pasos.push({ tab: 'taller', sel: 'plan', titulo: 'Mi trabajo', texto: 'Aquí ves el plan del día de las estaciones del taller.' });
  }
  if (['direccion', 'jefa', 'admin'].includes(rol)) {
    pasos.push({ tab: 'clientes', sel: 'pestanas', titulo: 'Clientes', texto: 'Cada pedido y cotización queda ligado a su cliente. Aquí ves por cliente los pedidos, unidades, lo vendido, lo que falta cobrar, la tasa de aprobación de cotizaciones y la puntualidad de entrega.' });
    pasos.push({ tab: 'costos', sel: 'costos-nav', titulo: 'Costos y cotizaciones', texto: 'Costo por pedido compara lo presupuestado con lo real y muestra el margen. Cotizaciones arma presupuestos para clientes con precio sugerido y los convierte en pedidos. En Materiales, Recetas y Mano de obra se cargan los precios y consumos que alimentan todo el cálculo.' });
  }
  if (rol === 'compras') {
    pasos.push({ tab: 'materiales', sel: 'materiales', titulo: 'Materiales', texto: 'La lista de precios de los materiales. Mantén los precios al día: con ellos se calculan los costos. Para cargar material a un pedido, ve a Pedidos → Materiales, elige el material, pon la cantidad y la app calcula el total.' });
  }
  if (rol === 'direccion') {
    pasos.push(
      { tab: 'ajustes', sel: 'drive', titulo: 'Google Drive', texto: 'Conecta aquí la cuenta de Google del taller. Desde ese momento, en cada paso importante la app guarda el documento en la carpeta del pedido y anota el paso en la hoja Seguimiento de pedidos.' },
      { tab: 'usuarios', sel: 'invitar', titulo: 'Invitar al equipo', texto: 'Nombre, correo, rol y estación. A la persona le llega un correo para crear su contraseña.' },
      { tab: 'usuarios', sel: 'enlaces', titulo: 'Enlaces por rol', texto: 'También puedes crear un enlace para cada rol y estación y mandarlo por WhatsApp: la persona se registra sola y entra con su rol. Puedes ponerle vencimiento, máximo de registros o desactivarlo.' },
      { tab: 'usuarios', sel: 'equipo', titulo: 'Equipo', texto: 'Cambia el rol o la estación de cada persona. La estación define la capacidad del taller. Si alguien sale, pulsa Desactivar: su historial se conserva.' },
    );
  }
  pasos.push({ sel: 'avisos', titulo: 'Notificaciones', texto: 'Actívalas en cada dispositivo para enterarte de pedidos nuevos, alertas en rojo, etapas terminadas y más, aunque la app esté cerrada. Ahí mismo eliges qué tipos quieres recibir.' });
  pasos.push(FIN);
  return pasos;
}
