// Política de privacidad pública (requisito de Google para publicar la conexión con Google Drive)
export const metadata = { title: 'Política de privacidad · Taller Hawaiira' };

const CORREO = process.env.GMAIL_USER || 'tallerhawaiira@gmail.com';

export default function Privacidad() {
  return (
    <main className="legal">
      <img src="/logo.svg" alt="Hawaiira Studio" className="legal-logo" />
      <h1>Política de privacidad de Taller Hawaiira</h1>
      <p className="lead">Última actualización: 20 de octubre de 2026</p>
      <p>Taller Hawaiira (la "app") es la app interna de control de pedidos del taller de confección Hawaiira Studio, El Hatillo, Caracas, Venezuela. Esta política explica qué datos usa la app y cómo los protege. Contacto: <b>{CORREO}</b>.</p>

      <h2>1. Datos del personal</h2>
      <p>Para cada persona del taller la app guarda su nombre, correo, rol, estación de trabajo y los registros de producción que hace (piezas, fechas y tiempos). Se usan solo para planificar y controlar la producción del taller.</p>

      <h2>2. Datos de clientes y pedidos</h2>
      <p>La app guarda los datos comerciales de los pedidos: cliente, productos, cantidades, fechas, montos, órdenes de compra y documentos del pedido. Se usan solo para atender esos pedidos.</p>

      <h2>3. Datos de Google</h2>
      <p>Si la dirección del taller conecta una cuenta de Google, la app pide únicamente estos permisos:</p>
      <ul>
        <li><b>Google Drive, solo archivos creados por la app</b> (<code>drive.file</code>): para crear la carpeta "Taller Hawaiira · Documentos", guardar en ella los documentos de cada pedido y actualizar la hoja "Seguimiento de pedidos". La app no puede ver, leer ni modificar ningún otro archivo de la cuenta.</li>
        <li><b>Dirección de correo de la cuenta</b> (<code>email</code>, <code>openid</code>): para mostrar en la app qué cuenta está conectada.</li>
      </ul>
      <p>El permiso de Google se guarda en la base de datos privada de la app, a la que no acceden las personas usuarias, y solo lo usa el servidor para subir esos documentos. Los datos obtenidos de Google no se venden, no se comparten con terceros, no se usan para publicidad y no se usan para entrenar modelos de inteligencia artificial.</p>
      <p>El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se ajustará a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Política de datos de usuario de los servicios de API de Google</a>, incluidos los requisitos de Uso Limitado.</p>

      <h2>4. Dónde se guardan</h2>
      <p>Los datos de la app se guardan en Supabase (base de datos) y la app se publica en Vercel. Los documentos exportados quedan en el Google Drive del propio taller.</p>

      <h2>5. Cómo quitar el acceso y borrar datos</h2>
      <ul>
        <li>La dirección puede desconectar Google Drive en cualquier momento en <b>Ajustes → Google Drive → Desconectar</b>, o desde <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>. Al desconectar, la app borra el permiso guardado; los archivos que ya se subieron siguen en el Drive del taller y se pueden borrar desde Drive.</li>
        <li>Cualquier persona puede pedir que se borren sus datos escribiendo a <b>{CORREO}</b>.</li>
      </ul>

      <h2>6. Cambios</h2>
      <p>Si esta política cambia, se publicará aquí con la nueva fecha.</p>
      <p className="links"><a className="btn" href="/acerca">Volver a Taller Hawaiira</a></p>
      <footer>Hawaiira Studio · Del Taller al Mundo</footer>
    </main>
  );
}
