'use client';
import { useMemo, useState } from 'react';
import { usd } from '@/lib/costos';
import { nf1 } from '@/lib/motor';

const VACIO = { material_id: '', cantidad: '', precio: '', nota: '', guardarPrecio: true };

// Guarda un material en un pedido (y, si se pide, el precio nuevo en la lista de precios)
export async function agregarMaterialPedido(supabase, ordenId, f, materiales) {
  const m = materiales.find((x) => x.id === f.material_id);
  const precio = Math.max(0, +f.precio || 0);
  const { error } = await supabase.from('consumos').insert({ orden_id: ordenId, material_id: f.material_id, cantidad: +f.cantidad, costo_unit: precio, nota: (f.nota || '').trim() });
  if (error) return { error };
  if (m && f.guardarPrecio && precio > 0 && precio !== +m.costo) await supabase.from('materiales').update({ costo: precio }).eq('id', m.id);
  return { m, precio, total: precio * +f.cantidad };
}

// Elegir material de la lista de precios, poner la cantidad y ver el total
export default function AgregarMaterial({ materiales = [], idBase = 'am', busy, onAgregar }) {
  const [f, setF] = useState(VACIO);
  const [buscar, setBuscar] = useState('');
  const [err, setErr] = useState('');
  const activos = materiales.filter((m) => m.activo !== false);
  const m = activos.find((x) => x.id === f.material_id);
  const grupos = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const g = {};
    activos.filter((x) => !q || (x.nombre + ' ' + (x.proveedor || '') + ' ' + x.categoria).toLowerCase().includes(q))
      .forEach((x) => { (g[x.categoria] = g[x.categoria] || []).push(x); });
    return g;
  }, [activos, buscar]);
  const precio = +f.precio || 0, cant = +f.cantidad || 0, total = precio * cant;
  const cambiaPrecio = m && precio > 0 && precio !== +m.costo;

  function elegir(id) {
    const x = activos.find((y) => y.id === id);
    setF({ ...f, material_id: id, precio: x && +x.costo > 0 ? String(+x.costo) : '' });
  }
  async function enviar(e) {
    e.preventDefault();
    if (!f.material_id) return setErr('Elige el material.');
    if (!(cant > 0)) return setErr('Escribe la cantidad.');
    if (!(precio > 0)) return setErr('Escribe el precio por ' + (m ? m.unidad : 'unidad') + '.');
    setErr('');
    const ok = await onAgregar({ ...f, guardarPrecio: f.guardarPrecio && cambiaPrecio });
    if (ok !== false) { setF(VACIO); setBuscar(''); }
  }

  return (
    <form className="agregar-mat" onSubmit={enviar} noValidate>
      <div className="fgrid">
        <label className="f">Buscar en la lista<input id={idBase + '-buscar'} value={buscar} placeholder="Tela, botón, proveedor…" onChange={(e) => setBuscar(e.target.value)} /></label>
        <label className="f">Material
          <select id={idBase + '-mat'} value={f.material_id} onChange={(e) => elegir(e.target.value)}>
            <option value="">{Object.keys(grupos).length ? 'Elegir…' : 'Nada coincide'}</option>
            {Object.entries(grupos).map(([cat, xs]) => (
              <optgroup key={cat} label={cat}>
                {xs.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {+x.costo > 0 ? usd.format(+x.costo) + '/' + x.unidad : 'sin precio'}{x.maneja_stock ? ` · almacén ${nf1.format(+x.stock || 0)}` : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="f">Cantidad{m ? ` (${m.unidad})` : ''}<input id={idBase + '-cant'} type="number" step="0.01" min="0" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></label>
        <label className="f">Precio por {m ? m.unidad : 'unidad'} (US$)<input id={idBase + '-precio'} type="number" step="0.01" min="0" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></label>
        <label className="f">Nota (opcional)<input id={idBase + '-nota'} value={f.nota} placeholder="Ej. color negro, proveedor X" onChange={(e) => setF({ ...f, nota: e.target.value })} /></label>
      </div>
      <div className="am-total">
        <div>
          <span className="small muted">Total de este material</span>
          <b>{usd.format(total)}</b>
          {m && cant > 0 && precio > 0 && <span className="small muted">{nf1.format(cant)} {m.unidad} × {usd.format(precio)}</span>}
        </div>
        {cambiaPrecio && <label className="small"><input type="checkbox" checked={f.guardarPrecio} onChange={(e) => setF({ ...f, guardarPrecio: e.target.checked })} /> Actualizar la lista: {usd.format(+m.costo)} → {usd.format(precio)}</label>}
        {m && !(+m.costo > 0) && <span className="small" style={{ color: 'var(--warn)' }}>Este material no tiene precio en la lista: el que escribas se guarda.</span>}
        <button className="btn sm primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Agregar al pedido'}</button>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
    </form>
  );
}

// Tabla de materiales de un pedido con su total
export function totalMateriales(salidas) { return salidas.reduce((a, c) => a + (+c.cantidad || 0) * (+c.costo_unit || 0), 0); }
