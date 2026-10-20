// Página pública de la app (la que se registra en Google como "Página principal de la aplicación")
export const metadata = { title: 'Taller Hawaiira · App de control del taller', description: 'App interna de control y seguimiento de pedidos del taller de confección Hawaiira Studio.' };

export default function Acerca() {
  return (
    <main className="legal">
      <img src="/logo.svg" alt="Hawaiira Studio" className="legal-logo" />
      <h1>Taller Hawaiira</h1>
      <p className="lead">Taller Hawaiira es la app interna de control y seguimiento de pedidos del taller de confección Hawaiira Studio, en El Hatillo, Caracas, Venezuela.</p>
      <h2>Qué hace</h2>
      <ul>
        <li>Planifica la producción del taller (corte, costura, serigrafía, bordado, DTF y empaque) y avisa de atrasos y cuellos de botella.</li>
        <li>Registra cotizaciones, órdenes de compra de clientes, pedidos y su avance paso a paso, de la cotización al cobro.</li>
        <li>Guarda los documentos de cada pedido (cotización, orden de producción, nota de entrega e informe de cierre) en el Google Drive del propio taller.</li>
      </ul>
      <h2>Quién la usa</h2>
      <p>Solo el personal de Hawaiira Studio, con una cuenta creada por la dirección del taller. No está abierta al público.</p>
      <h2>Uso de Google Drive</h2>
      <p>Taller Hawaiira se conecta a la cuenta de Google del taller con el permiso más limitado de Google Drive: solo puede ver y modificar las carpetas y archivos que la misma app crea. No lee ningún otro archivo de la cuenta. El detalle está en la <a href="/privacidad">Política de privacidad</a>.</p>
      <p className="links"><a className="btn primary" href="/login">Entrar al taller</a> <a className="btn" href="/privacidad">Política de privacidad</a></p>
      <footer>Hawaiira Studio · Del Taller al Mundo</footer>
    </main>
  );
}
