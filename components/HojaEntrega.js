import { fechaCorta } from '@/lib/formatoCotizacion';
import { lineasNota, referenciaPedido, OBS_NOTA, GRACIAS_NOTA } from '@/lib/notaEntrega';

// Nota de entrega con el formato de Hawaiira Studio (la usa la página /entrega/[numero])
export default function HojaEntrega({ numero, ordenes, cli, productos, cots, barra = null }) {
  const o0 = ordenes[0];
  const lineas = lineasNota(ordenes, { productos, cots });
  const fechaEnt = ordenes.map((o) => o.entregado).filter(Boolean).sort().pop();
  const obs = ordenes.map((o) => o.notaObs).find(Boolean) || OBS_NOTA;
  const datos = [
    ['Nota de Entrega #', <b key="n">{numero}</b>],
    ['Fecha', fechaCorta(fechaEnt || new Date())],
    ['Cliente', String(o0.cliente || '').toUpperCase()],
    ['Dirección', (cli && cli.direccion) || ''],
    ['RIF', (cli && cli.rif) || ''],
    ['Pedido', referenciaPedido(ordenes)],
  ];
  return (
    <main className="cot">
      {barra}
      <article className="hoja cotf ne">
        <div className="cf-top">
          <table className="cf-datos ne-datos"><tbody>
            {datos.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
          </tbody></table>
          <img src="/logo.svg" alt="Hawaiira Studio" className="cf-logo" />
        </div>

        <table className="ne-items">
          <tbody>
            {lineas.map((l, k) => (
              <tr key={k}><td className="cod">{l.codigo}</td><td className="desc">{l.descripcion}</td><td className="cant">{new Intl.NumberFormat('es-VE').format(l.cantidad)}</td></tr>
            ))}
          </tbody>
        </table>

        <table className="ne-firma">
          <thead><tr><th>Fecha de recepción y firma del receptor:</th><th>Observaciones:</th></tr></thead>
          <tbody><tr><td /><td className="obs">{obs}</td></tr></tbody>
        </table>
        <p className="ne-gracias">{GRACIAS_NOTA}</p>
        <div className="ne-sello"><img src="/sello-hawaiira.png" alt="Inversiones Hawaiira, C.A." /></div>
      </article>
    </main>
  );
}
