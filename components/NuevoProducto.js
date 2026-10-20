'use client';
import { useState } from 'react';

// Mini formulario para crear un producto sin salir del pedido o la cotización.
export default function NuevoProducto({ supabase, productos, onCreado, onCancel }) {
  const [f, setF] = useState({ nombre: '', corte: '', costura: '', empaque: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function crear() {
    const nombre = f.nombre.trim();
    if (!nombre) return setErr('Escribe el nombre del producto.');
    const clave = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (productos[clave]) return setErr('Ese producto ya existe.');
    if (!(+f.costura > 0)) return setErr('Indica al menos los minutos de costura por pieza (aunque sea un estimado).');
    setBusy(true);
    const { error } = await supabase.rpc('agregar_producto', { p_clave: clave, p_nombre: nombre, p_corte: +f.corte || 0, p_costura: +f.costura || 0, p_empaque: +f.empaque || 0 });
    setBusy(false);
    if (error) return setErr('No se pudo crear: ' + error.message);
    onCreado(clave, nombre);
  }
  return (
    <div className="subcard">
      <b className="small">Nuevo producto</b>
      <div className="fgrid" style={{ marginTop: 8 }}>
        <label className="f">Nombre<input id="np-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Gorra, Hoodie, Polo" /></label>
        <label className="f">Min. corte / pieza<input id="np-corte" type="number" step="0.1" min="0" value={f.corte} onChange={(e) => setF({ ...f, corte: e.target.value })} /></label>
        <label className="f">Min. costura / pieza<input id="np-costura" type="number" step="0.1" min="0" value={f.costura} onChange={(e) => setF({ ...f, costura: e.target.value })} /></label>
        <label className="f">Min. empaque / pieza<input id="np-empaque" type="number" step="0.1" min="0" value={f.empaque} onChange={(e) => setF({ ...f, empaque: e.target.value })} /></label>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>Si no conoces los tiempos exactos, pon un estimado; se ajustan después en Ajustes.</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="formacts" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm primary" disabled={busy} onClick={crear}>{busy ? 'Creando…' : 'Crear producto'}</button>
        <button type="button" className="btn sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
