'use client';
import { useState } from 'react';
import { usd, CATEGORIAS_COSTO } from '@/lib/costos';
import { nf1, fd, parseDay, isoDay, hoyCaracas } from '@/lib/motor';

// Editar y agregar costos de un pedido: venta, salidas de material y costos adicionales
export default function EditorCostos({ supabase, o, materiales = [], salidas = [], extras = [], avisar, recargar }) {
  const [busy, setBusy] = useState(false);
  const [venta, setVenta] = useState(o.monto || '');
  const [edS, setEdS] = useState(null);   // salida en edición { id, cantidad, costo_unit }
  const [edX, setEdX] = useState(null);   // costo adicional en edición (o nuevo: id null)
  const [nuevaS, setNuevaS] = useState({ material_id: '', cantidad: '', nota: '' });
  const hoy = isoDay(hoyCaracas());

  async function correr(fn, ok, tablas) {
    if (busy) return false;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { avisar('No se pudo guardar: ' + (error.message || 'revisa la conexión.')); return false; }
    if (ok) avisar(ok);
    tablas.forEach((t) => recargar[t] && recargar[t]());
    return true;
  }

  const guardarVenta = () => correr(() => supabase.from('ordenes').update({ monto: Math.max(0, +venta || 0) }).eq('id', o.id), `${o.codigo}: venta actualizada.`, ['ordenes']);

  async function guardarSalida() {
    if (!(+edS.cantidad > 0)) return avisar('La cantidad debe ser mayor que cero.');
    if (await correr(() => supabase.from('consumos').update({ cantidad: +edS.cantidad, costo_unit: Math.max(0, +edS.costo_unit || 0) }).eq('id', edS.id), 'Salida de material corregida. El stock se ajustó.', ['consumos', 'materiales'])) setEdS(null);
  }
  async function agregarSalida(e) {
    e.preventDefault();
    if (!nuevaS.material_id) return avisar('Elige el material.');
    if (!(+nuevaS.cantidad > 0)) return avisar('Escribe la cantidad.');
    if (await correr(() => supabase.from('consumos').insert({ orden_id: o.id, material_id: nuevaS.material_id, cantidad: +nuevaS.cantidad, nota: nuevaS.nota.trim() }), 'Salida de material registrada.', ['consumos', 'materiales'])) setNuevaS({ material_id: '', cantidad: '', nota: '' });
  }
  async function guardarExtra(e) {
    e.preventDefault();
    if (!String(edX.concepto || '').trim()) return avisar('Escribe el concepto del costo.');
    if (!(+edX.monto >= 0) || edX.monto === '') return avisar('Escribe el monto en US$.');
    const fila = { categoria: edX.categoria, concepto: edX.concepto.trim(), monto: +edX.monto, fecha: edX.fecha || hoy, nota: String(edX.nota || '').trim() };
    const ok = await correr(() => (edX.id ? supabase.from('costos_pedido').update(fila).eq('id', edX.id) : supabase.from('costos_pedido').insert({ ...fila, orden_id: o.id })), edX.id ? 'Costo actualizado.' : 'Costo agregado.', ['costosPedido']);
    if (ok) setEdX(null);
  }
  const mat = (id) => materiales.find((x) => x.id === id);

  return (
    <div className="ed-costos" onClick={(e) => e.stopPropagation()}>
      <div className="ed-venta">
        <label className="f">Venta del pedido (US$)<input id={'venta-' + o.id} type="number" min="0" step="0.01" value={venta} onChange={(e) => setVenta(e.target.value)} /></label>
        <button className="btn sm" disabled={busy || +venta === +o.monto} onClick={guardarVenta}>Guardar venta</button>
      </div>

      <h4>Salidas de material</h4>
      <table>
        <thead><tr><th>Material</th><th className="r">Cantidad</th><th className="r">Precio unit.</th><th className="r">Costo</th><th /></tr></thead>
        <tbody>
          {salidas.map((c) => {
            const m = mat(c.material_id), ed = edS && edS.id === c.id;
            return (
              <tr key={c.id}>
                <td>{m ? m.nombre : '—'} <span className="muted small">{fd(new Date(c.ts))}{c.nota ? ' · ' + c.nota : ''}</span></td>
                <td className="r">{ed ? <input aria-label="Cantidad" type="number" step="0.01" min="0" value={edS.cantidad} onChange={(e) => setEdS({ ...edS, cantidad: e.target.value })} style={{ width: 90 }} /> : <>{nf1.format(c.cantidad)} {m ? m.unidad : ''}</>}</td>
                <td className="r">{ed ? <input aria-label="Precio unitario" type="number" step="0.01" min="0" value={edS.costo_unit} onChange={(e) => setEdS({ ...edS, costo_unit: e.target.value })} style={{ width: 90 }} /> : usd.format(+c.costo_unit || 0)}</td>
                <td className="r">{usd.format((ed ? +edS.cantidad * +edS.costo_unit : c.cantidad * c.costo_unit) || 0)}</td>
                <td className="r nowrap">
                  {ed ? <><button className="btn sm primary" disabled={busy} onClick={guardarSalida}>Guardar</button> <button className="btn sm" onClick={() => setEdS(null)}>Cancelar</button></>
                    : <><button className="btn sm" onClick={() => setEdS({ id: c.id, cantidad: c.cantidad, costo_unit: c.costo_unit })}>Editar</button> <button className="btn sm link" disabled={busy} onClick={() => correr(() => supabase.from('consumos').delete().eq('id', c.id), 'Salida eliminada. El material volvió al stock.', ['consumos', 'materiales'])}>Quitar</button></>}
                </td>
              </tr>
            );
          })}
          {!salidas.length && <tr><td colSpan={5} className="muted small">Sin salidas de material.</td></tr>}
        </tbody>
      </table>
      <form className="ed-fila" onSubmit={agregarSalida}>
        <select aria-label="Material" value={nuevaS.material_id} onChange={(e) => setNuevaS({ ...nuevaS, material_id: e.target.value })}>
          <option value="">Material…</option>
          {materiales.filter((m) => m.activo !== false).map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.unidad}) · {usd.format(+m.costo || 0)}</option>)}
        </select>
        <input aria-label="Cantidad" type="number" step="0.01" min="0" placeholder="Cantidad" value={nuevaS.cantidad} onChange={(e) => setNuevaS({ ...nuevaS, cantidad: e.target.value })} />
        <input aria-label="Nota" placeholder="Nota (opcional)" value={nuevaS.nota} onChange={(e) => setNuevaS({ ...nuevaS, nota: e.target.value })} />
        <button className="btn sm" type="submit" disabled={busy}>Agregar salida</button>
      </form>

      <h4>Costos adicionales</h4>
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th className="r">Monto</th><th /></tr></thead>
        <tbody>
          {extras.map((x) => (
            <tr key={x.id}>
              <td>{fd(parseDay(x.fecha))}</td>
              <td className="small">{CATEGORIAS_COSTO[x.categoria] || x.categoria}</td>
              <td>{x.concepto}{x.nota ? <div className="small muted">{x.nota}</div> : null}</td>
              <td className="r">{usd.format(+x.monto || 0)}</td>
              <td className="r nowrap"><button className="btn sm" onClick={() => setEdX({ ...x })}>Editar</button> <button className="btn sm link" disabled={busy} onClick={() => correr(() => supabase.from('costos_pedido').delete().eq('id', x.id), 'Costo eliminado.', ['costosPedido'])}>Quitar</button></td>
            </tr>
          ))}
          {!extras.length && <tr><td colSpan={5} className="muted small">Sin costos adicionales. Agrega transporte, servicios de terceros (bordado, estampado, confección), compras puntuales u horas extra.</td></tr>}
        </tbody>
      </table>
      {edX ? (
        <form className="ed-form" onSubmit={guardarExtra}>
          <div className="fgrid">
            <label className="f">Tipo<select value={edX.categoria} onChange={(e) => setEdX({ ...edX, categoria: e.target.value })}>{Object.entries(CATEGORIAS_COSTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="f">Concepto<input value={edX.concepto} placeholder="Ej. Envío a La Guaira" onChange={(e) => setEdX({ ...edX, concepto: e.target.value })} autoFocus /></label>
            <label className="f">Monto (US$)<input type="number" min="0" step="0.01" value={edX.monto} onChange={(e) => setEdX({ ...edX, monto: e.target.value })} /></label>
            <label className="f">Fecha<input type="date" value={edX.fecha || hoy} onChange={(e) => setEdX({ ...edX, fecha: e.target.value })} /></label>
            <label className="f">Nota (opcional)<input value={edX.nota || ''} onChange={(e) => setEdX({ ...edX, nota: e.target.value })} /></label>
          </div>
          <div className="formacts"><button className="btn sm primary" type="submit" disabled={busy}>{edX.id ? 'Guardar cambios' : 'Agregar costo'}</button><button className="btn sm" type="button" onClick={() => setEdX(null)}>Cancelar</button></div>
        </form>
      ) : <div className="formacts" style={{ marginTop: 6 }}><button className="btn sm primary" onClick={() => setEdX({ id: null, categoria: 'tercero', concepto: '', monto: '', fecha: hoy, nota: '' })}>Agregar costo</button></div>}
    </div>
  );
}
