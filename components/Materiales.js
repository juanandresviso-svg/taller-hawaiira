'use client';
import { revisarNovedades } from '@/lib/avisos';
import { useState } from 'react';
import { CATEGORIAS, UNIDADES, usd } from '@/lib/costos';
import { fd, nf1 } from '@/lib/motor';

const VACIO = { nombre: '', categoria: 'Telas', unidad: 'kg', costo: '', proveedor: '', maneja_stock: false, stock: '' };
const VIEJO_DIAS = 60; // un precio sin actualizar en 60 días se marca para revisar

// Lista de precios de materiales. La mayoría se compra para cada pedido; el stock solo se lleva
// en los materiales marcados "en almacén".
export default function Materiales({ supabase, perfil, materiales, consumos, avisar, recargar }) {
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState('todas');
  const [ver, setVer] = useState('activos');
  const [q, setQ] = useState('');
  const puedeBorrar = ['direccion', 'admin'].includes(perfil.rol);
  const hace = (d) => (d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null);

  async function agregar(e) {
    e.preventDefault();
    if (!f.nombre.trim()) return setErr('Escribe el nombre del material.');
    if (materiales.some((m) => m.nombre.trim().toLowerCase() === f.nombre.trim().toLowerCase() && m.activo !== false)) return setErr('Ese material ya está en la lista. Cambia su precio en la tabla.');
    setBusy(true);
    const fila = { nombre: f.nombre.trim(), categoria: f.categoria, unidad: f.unidad, costo: Math.max(0, +f.costo || 0), proveedor: f.proveedor.trim(), maneja_stock: f.maneja_stock, stock: f.maneja_stock ? +f.stock || 0 : 0 };
    let { error } = await supabase.from('materiales').insert(fila);
    if (error && /maneja_stock/.test(error.message)) { const { maneja_stock, ...vieja } = fila; ({ error } = await supabase.from('materiales').insert(vieja)); } // antes de la migración 10
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + error.message);
    avisar(`"${f.nombre.trim()}" agregado a la lista de precios.`);
    setF({ ...VACIO, categoria: f.categoria, unidad: f.unidad }); setErr('');
    recargar.materiales();
  }
  async function actualizar(id, cambios) {
    const { error } = await supabase.from('materiales').update(cambios).eq('id', id);
    if (error) avisar('No se pudo guardar: ' + error.message); else { recargar.materiales(); if ('stock' in cambios || 'maneja_stock' in cambios) revisarNovedades(); }
  }
  async function borrar(m) {
    if (consumos.some((c) => c.material_id === m.id)) return actualizar(m.id, { activo: false });
    const { error } = await supabase.from('materiales').delete().eq('id', m.id);
    if (error) avisar('No se pudo borrar: ' + error.message); else recargar.materiales();
  }

  const qq = q.trim().toLowerCase();
  const lista = materiales.filter((m) => (ver === 'activos' ? m.activo !== false : ver === 'almacen' ? m.activo !== false && m.maneja_stock : m.activo === false)
    && (cat === 'todas' || m.categoria === cat)
    && (!qq || (m.nombre + ' ' + (m.proveedor || '')).toLowerCase().includes(qq)));
  const activos = materiales.filter((m) => m.activo !== false);
  const sinPrecio = activos.filter((m) => !(+m.costo > 0)).length;
  const viejos = activos.filter((m) => +m.costo > 0 && hace(m.precio_fecha) != null && hace(m.precio_fecha) > VIEJO_DIAS).length;
  const enAlmacen = activos.filter((m) => m.maneja_stock).length;

  return (
    <>
      <div className="kpis" style={{ marginBottom: 14 }} data-tour="materiales">
        <div className="kpi"><span className="k">Materiales en la lista</span><span className="v">{activos.length}</span></div>
        <div className="kpi"><span className="k">Sin precio</span><span className={'v ' + (sinPrecio ? 'neg' : '')}>{sinPrecio}</span></div>
        <div className="kpi"><span className="k">Precio de más de {VIEJO_DIAS} días</span><span className={'v ' + (viejos ? 'neg' : '')}>{viejos}</span></div>
        <div className="kpi"><span className="k">Se llevan en almacén</span><span className="v">{enAlmacen}</span></div>
      </div>

      <form className="card" onSubmit={agregar} noValidate style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>Agregar a la lista de precios</h3>
        <p className="small muted" style={{ margin: '0 0 10px' }}>Guarda el material con su precio de compra. Al cargarlo a un pedido solo pones la cantidad y la app calcula el total.</p>
        <div className="fgrid">
          <label className="f">Nombre<input id="mat-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Tela jersey negra 30/1" /></label>
          <label className="f">Categoría<select id="mat-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Unidad<select id="mat-uni" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{UNIDADES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Precio por {f.unidad} (US$)<input id="mat-costo" type="number" step="0.01" min="0" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></label>
          <label className="f">Proveedor<input id="mat-prov" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} /></label>
          {f.maneja_stock && <label className="f">Cantidad en almacén<input id="mat-stock" type="number" step="0.01" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></label>}
        </div>
        <label className="small" style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={f.maneja_stock} onChange={(e) => setF({ ...f, maneja_stock: e.target.checked })} /> Lo tenemos en almacén (llevar stock)</label>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="formacts"><button className="btn primary" type="submit" disabled={busy}>Agregar</button></div>
      </form>

      <div className="toolbar">
        <input className="buscar" aria-label="Buscar material" placeholder="Buscar material o proveedor…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <div className="chips" style={{ margin: 0 }}>
          <button className="chip" aria-pressed={ver === 'activos'} onClick={() => setVer('activos')}>Todos</button>
          <button className="chip" aria-pressed={ver === 'almacen'} onClick={() => setVer('almacen')}>En almacén</button>
          <button className="chip" aria-pressed={ver === 'inactivos'} onClick={() => setVer('inactivos')}>Desactivados</button>
        </div>
      </div>
      <div className="chips" style={{ margin: '0 0 10px' }}>
        {['todas', ...CATEGORIAS].map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === 'todas' ? 'Todas' : c}</button>)}
      </div>
      <div className="panel scroll team lineas">
        <table>
          <thead><tr><th>Material</th><th>Categoría</th><th>Unidad</th><th className="r">Precio US$</th><th>Actualizado</th><th>Proveedor</th><th>Almacén</th><th></th></tr></thead>
          <tbody>
            {lista.map((m) => {
              const dias = hace(m.precio_fecha);
              return (
                <tr key={m.id}>
                  <td><input id={'mn-' + m.id} defaultValue={m.nombre} aria-label="Nombre" onBlur={(e) => e.target.value.trim() && e.target.value !== m.nombre && actualizar(m.id, { nombre: e.target.value.trim() })} /></td>
                  <td><select id={'mc-' + m.id} value={m.categoria} aria-label="Categoría" onChange={(e) => actualizar(m.id, { categoria: e.target.value })}>{[...new Set([...CATEGORIAS, m.categoria])].map((c) => <option key={c}>{c}</option>)}</select></td>
                  <td><select id={'mu-' + m.id} value={m.unidad} aria-label="Unidad" onChange={(e) => actualizar(m.id, { unidad: e.target.value })}>{[...new Set([...UNIDADES, m.unidad])].map((c) => <option key={c}>{c}</option>)}</select></td>
                  <td className="r"><input id={'mp-' + m.id} key={'p' + m.costo} type="number" step="0.01" min="0" defaultValue={m.costo} aria-label="Precio" style={!(+m.costo > 0) ? { borderColor: 'var(--bad)' } : undefined} onBlur={(e) => +e.target.value !== +m.costo && actualizar(m.id, { costo: Math.max(0, +e.target.value || 0) })} /></td>
                  <td className="small nowrap" style={dias > VIEJO_DIAS ? { color: 'var(--warn)' } : undefined}>{m.precio_fecha ? fd(new Date(m.precio_fecha)) + (dias > VIEJO_DIAS ? ' · revisar' : '') : '—'}</td>
                  <td><input id={'mv-' + m.id} defaultValue={m.proveedor} aria-label="Proveedor" onBlur={(e) => e.target.value !== (m.proveedor || '') && actualizar(m.id, { proveedor: e.target.value })} /></td>
                  <td className="nowrap"><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className="small" title="Llevar stock de este material"><input type="checkbox" checked={!!m.maneja_stock} onChange={(e) => actualizar(m.id, { maneja_stock: e.target.checked })} />{m.maneja_stock ? '' : ' No'}</label>
                    {m.maneja_stock && <input id={'ms-' + m.id} key={'s' + m.stock} type="number" step="0.01" defaultValue={m.stock} aria-label="Cantidad en almacén" style={+m.stock <= 0 ? { borderColor: 'var(--bad)' } : undefined} onBlur={(e) => +e.target.value !== +m.stock && actualizar(m.id, { stock: +e.target.value || 0 })} />}
                    {m.maneja_stock && <span className="small muted">{m.unidad}</span>}
                  </div></td>
                  <td className="r">
                    {m.activo === false
                      ? <button className="btn sm" onClick={() => actualizar(m.id, { activo: true })}>Reactivar</button>
                      : puedeBorrar ? <button className="btn sm danger" onClick={() => borrar(m)}>{consumos.some((c) => c.material_id === m.id) ? 'Desactivar' : 'Eliminar'}</button> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!lista.length && <div className="empty" style={{ marginTop: 10 }}>No hay materiales en esta vista.</div>}
      </div>
      <p className="small muted">Cambia el precio cuando compres más caro o más barato; también se actualiza solo si al cargar material a un pedido escribes otro precio y dejas marcado "Actualizar la lista". Marca <b>Almacén</b> solo en lo que tienes guardado (hilos, etiquetas, empaque): a esos se les descuenta la cantidad cada vez que se usan en un pedido. {nf1.format(enAlmacen)} material{enAlmacen === 1 ? '' : 'es'} con stock.</p>
    </>
  );
}
