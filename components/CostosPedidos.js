'use client';
import { useState } from 'react';
import { usd, usd0 } from '@/lib/costos';
import { POOL_NAME, nf, nf1, pct, fd, parseDay } from '@/lib/motor';
import { decoTexto } from './ui';

// Costo presupuestado vs costo real de cada pedido, con su margen.
export default function CostosPedidos({ M, K, ordenes, consumos, materiales }) {
  const [filtro, setFiltro] = useState('activos');
  const [abierto, setAbierto] = useState(null);

  const lista = ordenes.filter((o) => (filtro === 'todos' ? true : filtro === 'activos' ? o.estado !== 'entregado' : o.estado === 'entregado'));
  const filas = lista.map((o) => {
    const p = K.presupuesto(o), r = K.real(o, consumos);
    const margen = o.monto ? (o.monto - p.total) / o.monto : null;
    const desvMat = r.materiales - p.materiales * Math.min(1, r.avance || 0);
    return { o, p, r, margen, desvMat };
  }).sort((a, b) => (a.margen ?? 9) - (b.margen ?? 9));

  const tVenta = filas.reduce((a, f) => a + (+f.o.monto || 0), 0);
  const tPres = filas.reduce((a, f) => a + f.p.total, 0);
  const tReal = filas.reduce((a, f) => a + f.r.total, 0);
  const tMat = filas.reduce((a, f) => a + f.r.materiales, 0);
  const incompletos = filas.filter((f) => f.p.faltantes.length).length;

  return (
    <>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><span className="k">Ventas ({filtro === 'activos' ? 'activos' : filtro})</span><span className="v">{usd0.format(tVenta)}</span></div>
        <div className="kpi"><span className="k">Costo presupuestado</span><span className="v">{usd0.format(tPres)}</span></div>
        <div className="kpi"><span className="k">Margen estimado</span><span className={'v ' + (tVenta && (tVenta - tPres) / tVenta < 0.15 ? 'neg' : 'pos')}>{tVenta ? pct((tVenta - tPres) / tVenta) : '—'}</span></div>
        <div className="kpi"><span className="k">Costo real a la fecha</span><span className="v">{usd0.format(tReal)}</span></div>
        <div className="kpi"><span className="k">Material que ya salió</span><span className="v">{usd0.format(tMat)}</span></div>
      </div>
      {incompletos > 0 && <div className="banner warn">{incompletos} pedido{incompletos > 1 ? 's tienen' : ' tiene'} el costo incompleto (falta receta, precios de materiales o mano de obra). Complétalo en Recetas, Materiales y Parámetros.</div>}

      <div className="chips">
        {[['activos', 'Activos'], ['entregados', 'Entregados'], ['todos', 'Todos']].map(([k, v]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{v}</button>)}
      </div>
      <div className="panel scroll">
        <table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th className="r">Cant.</th><th className="r">Venta</th><th className="r">Presupuesto</th><th className="r">Margen est.</th><th className="r">Real a la fecha</th><th className="r">Avance</th><th className="r">Material vs. presupuesto</th></tr></thead>
          <tbody>
            {filas.map(({ o, p, r, margen, desvMat }) => (
              <FilaPedido key={o.id} {...{ o, p, r, margen, desvMat, M, K, materiales }} abierto={abierto === o.id} onClick={() => setAbierto(abierto === o.id ? null : o.id)} />
            ))}
          </tbody>
        </table>
        {!filas.length && <div className="empty" style={{ marginTop: 10 }}>No hay pedidos en esta vista.</div>}
      </div>
      <p className="small muted">Presupuesto = materiales según receta + mano de obra según tiempos estándar + bordado externo + indirectos. Real a la fecha = material que salió del almacén para el pedido + mano de obra de las piezas ya registradas + indirectos. "Material vs. presupuesto" compara lo que salió con lo que debería haber salido según el avance: en rojo, se está gastando de más.</p>
    </>
  );
}

function FilaPedido({ o, p, r, margen, desvMat, M, K, abierto, onClick, materiales }) {
  const sug = K.precioSugerido(p.unitario);
  return (
    <>
      <tr className="click" onClick={onClick} aria-expanded={abierto}>
        <td className="mono">{o.codigo}</td>
        <td>{o.cliente}{p.faltantes.length ? <span className="pill amarillo" style={{ marginLeft: 6 }}>incompleto</span> : null}</td>
        <td className="r">{nf.format(o.cantidad)}</td>
        <td className="r">{o.monto ? usd0.format(o.monto) : '—'}</td>
        <td className="r">{usd0.format(p.total)}</td>
        <td className={'r ' + (margen == null ? '' : margen < 0.15 ? 'neg' : 'pos')}>{margen == null ? '—' : pct(margen)}</td>
        <td className="r">{usd0.format(r.total)}</td>
        <td className="r">{pct(Math.min(1, r.avance))}</td>
        <td className={'r ' + (r.salidas.length ? (desvMat > p.materiales * 0.05 ? 'neg' : 'pos') : 'muted')}>{r.salidas.length ? (desvMat > 0 ? '+' : '') + usd0.format(desvMat) : 'sin salidas'}</td>
      </tr>
      {abierto && (
        <tr><td colSpan={9} style={{ background: 'var(--surface-2)' }}>
          <div className="grid2" style={{ gap: 14, padding: '6px 0' }}>
            <div>
              <b>Presupuesto · {M.prod(o).nombre} × {nf.format(o.cantidad)} · {decoTexto(o.deco)}</b>
              <table style={{ marginTop: 6 }}>
                <tbody>
                  {p.lineas.map((l, i) => <tr key={i}><td>{l.material} <span className="muted small">({l.grupo})</span></td><td className="r small">{nf1.format(l.qty)} {l.unidad}</td><td className={'r ' + (l.sinPrecio ? 'neg' : '')}>{l.sinPrecio ? 'sin precio' : usd.format(l.costo)}</td></tr>)}
                  {p.externo > 0 && <tr><td>Bordado externo (aliado)</td><td></td><td className="r">{usd.format(p.externo)}</td></tr>}
                  {Object.entries(p.mo).map(([pool, v]) => <tr key={pool}><td>Mano de obra · {POOL_NAME[pool]}</td><td></td><td className="r">{usd.format(v)}</td></tr>)}
                  <tr><td>Gastos indirectos ({nf1.format(p.minutos / 60)} h de producción)</td><td></td><td className="r">{usd.format(p.indirectos)}</td></tr>
                  <tr><td><b>Total</b></td><td className="r small">{usd.format(p.unitario)} / pieza</td><td className="r"><b>{usd.format(p.total)}</b></td></tr>
                </tbody>
              </table>
              <p className="small" style={{ marginBottom: 0 }}>Precio sugerido con {K.C.margen}% de margen: <b>{usd.format(sug)}</b> por pieza{o.monto ? <> · vendido a <b>{usd.format(o.monto / o.cantidad)}</b></> : null}.</p>
              {p.faltantes.length > 0 && <p className="small" style={{ color: 'var(--warn)', marginBottom: 0 }}>Falta: {p.faltantes.join(', ')}.</p>}
            </div>
            <div>
              <b>Real a la fecha · avance {pct(Math.min(1, r.avance))}</b>
              <table style={{ marginTop: 6 }}>
                <tbody>
                  {r.salidas.map((c) => { const m = materiales.find((x) => x.id === c.material_id); return <tr key={c.id}><td>{m ? m.nombre : '—'} <span className="muted small">{fd(new Date(c.ts))}</span></td><td className="r small">{nf1.format(c.cantidad)} {m ? m.unidad : ''}</td><td className="r">{usd.format(c.cantidad * c.costo_unit)}</td></tr>; })}
                  {!r.salidas.length && <tr><td colSpan={3} className="muted small">Todavía no hay salidas de material registradas para este pedido (Pedidos → Salida de material).</td></tr>}
                  <tr><td>Materiales</td><td></td><td className="r">{usd.format(r.materiales)}</td></tr>
                  {r.externo > 0 && <tr><td>Bordado externo recibido</td><td></td><td className="r">{usd.format(r.externo)}</td></tr>}
                  <tr><td>Mano de obra de las piezas registradas</td><td></td><td className="r">{usd.format(r.manoObra)}</td></tr>
                  <tr><td>Gastos indirectos</td><td></td><td className="r">{usd.format(r.indirectos)}</td></tr>
                  <tr><td><b>Total a la fecha</b></td><td></td><td className="r"><b>{usd.format(r.total)}</b></td></tr>
                </tbody>
              </table>
              <p className="small muted" style={{ marginBottom: 0 }}>Entrega comprometida: {fd(parseDay(o.fechaCompromiso))}. <a href={'/informe/' + o.id} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}>Ver informe de producción</a></p>
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}
