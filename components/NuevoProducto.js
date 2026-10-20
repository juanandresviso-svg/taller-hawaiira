'use client';
import { useState } from 'react';
import { estimarProducto } from '@/lib/aprendizaje';
import { nf1 } from '@/lib/motor';

// Crear un producto solo con el nombre. Los tiempos arrancan como estimado (promedio de los productos conocidos)
// y la app los ajusta sola con la producción real.
export default function NuevoProducto({ supabase, cfg, onCreado, onCancel }) {
  const est = estimarProducto(cfg);
  const [nombre, setNombre] = useState('');
  const [conozco, setConozco] = useState(false);
  const [t, setT] = useState({ corte: '', costura: '', empaque: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function crear() {
    const n = nombre.trim();
    if (!n) return setErr('Escribe el nombre del producto.');
    const clave = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (cfg.productos[clave]) return setErr('Ese producto ya existe.');
    const propios = conozco && +t.costura > 0;
    const v = (k) => (propios && +t[k] > 0 ? +t[k] : est[k]);
    setBusy(true);
    const { error } = await supabase.rpc('agregar_producto', { p_clave: clave, p_nombre: n, p_corte: v('corte'), p_costura: v('costura'), p_empaque: v('empaque'), p_estimado: !propios });
    setBusy(false);
    if (error) return setErr('No se pudo crear: ' + error.message);
    onCreado(clave, n);
  }
  return (
    <div className="subcard">
      <b className="small">Nuevo producto</b>
      <div className="fgrid" style={{ marginTop: 8 }}>
        <label className="f">Nombre<input id="np-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Gorra, Hoodie, Polo" /></label>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        No hace falta saber los tiempos. La app arranca con un estimado (corte {nf1.format(est.corte)}, costura {nf1.format(est.costura)}, empaque {nf1.format(est.empaque)} min por pieza) y lo corrige sola con lo que se vaya registrando en el taller.
      </p>
      <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}><input type="checkbox" checked={conozco} onChange={(e) => setConozco(e.target.checked)} />Ya conozco los tiempos de este producto</label>
      {conozco && (
        <div className="fgrid" style={{ marginTop: 8 }}>
          {[['corte', 'Min. corte / pieza'], ['costura', 'Min. costura / pieza'], ['empaque', 'Min. empaque / pieza']].map(([k, l]) => (
            <label key={k} className="f">{l}<input id={'np-' + k} type="number" step="0.1" min="0" placeholder={nf1.format(est[k])} value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></label>
          ))}
        </div>
      )}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="formacts" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm primary" disabled={busy} onClick={crear}>{busy ? 'Creando…' : 'Crear producto'}</button>
        <button type="button" className="btn sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
