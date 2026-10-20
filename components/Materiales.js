'use client';
import { useState } from 'react';
import { CATEGORIAS, UNIDADES, usd } from '@/lib/costos';

const VACIO = { nombre: '', categoria: 'Telas', unidad: 'kg', costo: '', proveedor: '', stock: '' };

export default function Materiales({ supabase, perfil, materiales, consumos, avisar, recargar }) {
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState('todas');
  const [ver, setVer] = useState('activos');
  const puedeBorrar = ['direccion', 'admin'].includes(perfil.rol);

  async function agregar(e) {
    e.preventDefault();
    if (!f.nombre.trim()) return setErr('Escribe el nombre del material.');
    setBusy(true);
    const { error } = await supabase.from('materiales').insert({ nombre: f.nombre.trim(), categoria: f.categoria, unidad: f.unidad, costo: Math.max(0, +f.costo || 0), proveedor: f.proveedor.trim(), stock: +f.stock || 0 });
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + error.message);
    avisar(`Material "${f.nombre.trim()}" agregado.`);
    setF({ ...VACIO, categoria: f.categoria, unidad: f.unidad }); setErr('');
    recargar.materiales();
  }
  async function actualizar(id, cambios) {
    const { error } = await supabase.from('materiales').update(cambios).eq('id', id);
    if (error) avisar('No se pudo guardar: ' + error.message); else recargar.materiales();
  }
  async function borrar(m) {
    if (consumos.some((c) => c.material_id === m.id)) return actualizar(m.id, { activo: false });
    const { error } = await supabase.from('materiales').delete().eq('id', m.id);
    if (error) avisar('No se pudo borrar: ' + error.message); else recargar.materiales();
  }

  const lista = materiales.filter((m) => (ver === 'activos' ? m.activo !== false : m.activo === false) && (cat === 'todas' || m.categoria === cat));
  const sinPrecio = materiales.filter((m) => m.activo !== false && !(+m.costo > 0)).length;
  const valorStock = materiales.reduce((a, m) => a + Math.max(0, +m.stock || 0) * (+m.costo || 0), 0);

  return (
    <>
      <div className="kpis" style={{ marginBottom: 14 }} data-tour="materiales">
        <div className="kpi"><span className="k">Materiales activos</span><span className="v">{materiales.filter((m) => m.activo !== false).length}</span></div>
        <div className="kpi"><span className="k">Sin precio cargado</span><span className={'v ' + (sinPrecio ? 'neg' : '')}>{sinPrecio}</span></div>
        <div className="kpi"><span className="k">Valor del inventario</span><span className="v">{usd.format(valorStock)}</span></div>
      </div>

      <form className="card" onSubmit={agregar} noValidate style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 10 }}>Agregar material</h3>
        <div className="fgrid">
          <label className="f">Nombre<input id="mat-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Tela jersey negra 30/1" /></label>
          <label className="f">Categoría<select id="mat-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Unidad<select id="mat-uni" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{UNIDADES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Costo por unidad (US$)<input id="mat-costo" type="number" step="0.01" min="0" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></label>
          <label className="f">Proveedor<input id="mat-prov" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} /></label>
          <label className="f">Stock actual<input id="mat-stock" type="number" step="0.01" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></label>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="formacts"><button className="btn primary" type="submit" disabled={busy}>Agregar</button></div>
      </form>

      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {['todas', ...CATEGORIAS].map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === 'todas' ? 'Todas' : c}</button>)}
        </div>
        <div className="chips" style={{ margin: 0 }}>
          <button className="chip" aria-pressed={ver === 'activos'} onClick={() => setVer('activos')}>Activos</button>
          <button className="chip" aria-pressed={ver === 'inactivos'} onClick={() => setVer('inactivos')}>Desactivados</button>
        </div>
      </div>
      <div className="panel scroll team lineas">
        <table>
          <thead><tr><th>Material</th><th>Categoría</th><th>Unidad</th><th className="r">Costo US$</th><th>Proveedor</th><th className="r">Stock</th><th></th></tr></thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td><input id={'mn-' + m.id} defaultValue={m.nombre} aria-label="Nombre" onBlur={(e) => e.target.value.trim() && e.target.value !== m.nombre && actualizar(m.id, { nombre: e.target.value.trim() })} /></td>
                <td><select id={'mc-' + m.id} value={m.categoria} aria-label="Categoría" onChange={(e) => actualizar(m.id, { categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></td>
                <td><select id={'mu-' + m.id} value={m.unidad} aria-label="Unidad" onChange={(e) => actualizar(m.id, { unidad: e.target.value })}>{[...new Set([...UNIDADES, m.unidad])].map((c) => <option key={c}>{c}</option>)}</select></td>
                <td className="r"><input id={'mp-' + m.id} type="number" step="0.01" min="0" defaultValue={m.costo} aria-label="Costo" style={!(+m.costo > 0) ? { borderColor: 'var(--bad)' } : undefined} onBlur={(e) => +e.target.value !== +m.costo && actualizar(m.id, { costo: Math.max(0, +e.target.value || 0) })} /></td>
                <td><input id={'mv-' + m.id} defaultValue={m.proveedor} aria-label="Proveedor" onBlur={(e) => e.target.value !== (m.proveedor || '') && actualizar(m.id, { proveedor: e.target.value })} /></td>
                <td className="r"><input id={'ms-' + m.id} type="number" step="0.01" defaultValue={m.stock} aria-label="Stock" style={+m.stock < 0 ? { borderColor: 'var(--bad)' } : undefined} onBlur={(e) => +e.target.value !== +m.stock && actualizar(m.id, { stock: +e.target.value || 0 })} /></td>
                <td className="r">
                  {m.activo === false
                    ? <button className="btn sm" onClick={() => actualizar(m.id, { activo: true })}>Reactivar</button>
                    : puedeBorrar ? <button className="btn sm danger" onClick={() => borrar(m)}>{consumos.some((c) => c.material_id === m.id) ? 'Desactivar' : 'Eliminar'}</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <div className="empty" style={{ marginTop: 10 }}>No hay materiales en esta vista.</div>}
      </div>
      <p className="small muted">El stock baja solo con cada salida de material registrada en un pedido. Cuando llegue una compra, suma la cantidad al stock aquí. Stock en rojo = negativo: revisa las salidas o actualiza el conteo.</p>
    </>
  );
}
