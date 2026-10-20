'use client';
import { useState } from 'react';
import { estimarProducto } from '@/lib/aprendizaje';
import { nf1 } from '@/lib/motor';

// Crear un producto solo con el nombre. Sus tiempos son un resultado de la producción real.
export default function NuevoProducto({ supabase, cfg, onCreado, onCancel }) {
  const est = estimarProducto(cfg);
  const [nombre, setNombre] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function crear() {
    const n = nombre.trim();
    if (!n) return setErr('Escribe el nombre del producto.');
    const clave = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (cfg.productos[clave]) return setErr('Ese producto ya existe.');
    setBusy(true);
    const { error } = await supabase.rpc('agregar_producto', { p_clave: clave, p_nombre: n, p_corte: est.corte, p_costura: est.costura, p_empaque: est.empaque, p_estimado: true });
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
        Los tiempos no se escriben: mientras no haya un pedido entregado de este producto, la app usa un estimado (corte {nf1.format(est.corte)}, costura {nf1.format(est.costura)}, empaque {nf1.format(est.empaque)} min por pieza). Cuando se entregue el primer pedido, pasa a usar los tiempos reales medidos.
      </p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="formacts" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm primary" disabled={busy} onClick={crear}>{busy ? 'Creando…' : 'Crear producto'}</button>
        <button type="button" className="btn sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
