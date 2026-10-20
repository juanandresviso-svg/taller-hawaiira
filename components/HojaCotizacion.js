import { codigoProducto, fechaCorta, montoNum, LEYENDA_IVA, OBSERVACIONES_BASE, PAGO_BASE } from '@/lib/formatoCotizacion';

const Monto = ({ v }) => <span className="cf-m"><span>$</span><span>{montoNum(v)}</span></span>;

// Hoja de cotización con el formato de Hawaiira Studio (la usa la página /cotizacion/[id])
export default function HojaCotizacion({ c, cli, emp, productos, barra = null }) {
  const items = c.items || [];
  const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const unidades = items.reduce((a, i) => a + (+i.cantidad || 0), 0);
  const datos = [
    ['# de Cotización', <b key="n">{String(c.numero).replace(/^COT-0*/, '')}</b>],
    ['Fecha', fechaCorta(c.creado)],
    ['Contacto', c.contacto || (cli && cli.contacto) || ''],
    ['Cliente', String(c.cliente || '').toUpperCase()],
    ['RIF', (cli && cli.rif) || ''],
    ['Dirección', (cli && cli.direccion) || ''],
    ['Teléfono', (cli && cli.telefono) || ''],
  ];

  return (
    <main className="cot">
      {barra}
      <article className="hoja cotf">
        <div className="cf-top">
          <table className="cf-datos"><tbody>
            {datos.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
          </tbody></table>
          <img src="/logo.svg" alt="Hawaiira Studio" className="cf-logo" />
        </div>

        <table className="cf-t cf-items">
          <thead><tr><th style={{ width: '11%' }}>Cod.</th><th>Descripción</th><th style={{ width: '13%' }}>Cantidad</th><th style={{ width: '15%' }}>Precio Unitario</th><th style={{ width: '15%' }}>Precio Total</th></tr></thead>
          <tbody>
            {items.map((i, k) => (
              <tr key={k}>
                <td className="c">{i.codigo || codigoProducto(i.producto, productos)}</td>
                <td className="desc">{String(i.descripcion || i.nombre || '').toUpperCase()}</td>
                <td className="c">{new Intl.NumberFormat('es-VE').format(i.cantidad)}</td>
                <td><Monto v={i.precio} /></td>
                <td><Monto v={i.cantidad * i.precio} /></td>
              </tr>
            ))}
            <tr className="sub"><td colSpan={2} className="c"><b>SUB-TOTAL</b></td><td className="c"><b>{new Intl.NumberFormat('es-VE').format(unidades)}</b></td><td /><td><Monto v={total} /></td></tr>
          </tbody>
        </table>

        <table className="cf-t cf-obs">
          <thead><tr><th>Observaciones:</th><th>Metodos de Pago</th></tr></thead>
          <tbody><tr>
            <td className="obs">{String(c.notas || emp.observaciones || OBSERVACIONES_BASE).toUpperCase()}</td>
            <td className="pago">{String(c.metodo_pago || emp.metodoPago || PAGO_BASE).toUpperCase()}</td>
          </tr></tbody>
        </table>
        <p className="cf-iva">{emp.leyendaIva || LEYENDA_IVA}</p>
        <p className="cf-txt">Le(s) damos las gracias por confiar en nosotros.</p>
        <p className="cf-txt">Atentamente,</p>
        <div className="cf-emp">
          <div>{emp.nombre}</div>
          {emp.rif && <div>{emp.rif}</div>}
          {emp.direccion && <div>{emp.direccion}</div>}
          {emp.ciudad && <div>{emp.ciudad}</div>}
          {[emp.telefono, emp.correo].filter(Boolean).length > 0 && <div>{[emp.telefono, emp.correo].filter(Boolean).join(' · ')}</div>}
        </div>
      </article>
    </main>
  );
}
