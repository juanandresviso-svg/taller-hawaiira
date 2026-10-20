'use client';
import { useState } from 'react';

const DECO_CAMPOS = [
  ['serigrafiaColor', 'Serigrafía: por pieza, por color y ubicación'],
  ['dtfUbicacion', 'DTF o vinil: por pieza y ubicación'],
  ['prepBase', 'Preprensa serigrafía: base por pedido'],
  ['prepColor', 'Preprensa serigrafía: adicional por color'],
  ['prepDtf', 'Preprensa DTF o vinil: por ubicación'],
  ['bordadoUbicacion', 'Bordado interno: por pieza y ubicación'],
  ['prepBordado', 'Ponchado (archivo de bordado): por ubicación'],
  ['bordadoExternoDias', 'Bordado externo: días hábiles que tarda el aliado'],
];

export default function Ajustes({ supabase, M, avisar }) {
  const [c, setC] = useState(() => structuredClone(M.cfg));
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const set = (path, val) => setC((d) => { const n = structuredClone(d); const ks = path.split('.'); let o = n; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; return n; });

  async function guardar() {
    const d = structuredClone(c);
    d.horasDia = Math.max(1, +d.horasDia || 8);
    d.eficiencia = Math.min(100, Math.max(10, +d.eficiencia || 85));
    Object.values(d.productos).forEach((p) => ['corte', 'costura', 'empaque'].forEach((f) => (p[f] = Math.max(0, +p[f] || 0))));
    Object.keys(d.deco).forEach((k) => (d.deco[k] = Math.max(0, +d.deco[k] || 0)));
    setBusy(true);
    const { error } = await supabase.from('config').update({ data: d, actualizado: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    avisar(error ? 'No se pudo guardar: ' + error.message : 'Ajustes guardados.');
  }
  function agregarProducto() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const key = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
    if (c.productos[key]) return avisar('Ese producto ya existe.');
    set('productos.' + key, { nombre, corte: 0, costura: 0, empaque: 0 });
    setNuevo('');
  }

  return (
    <>
      <h2>Capacidad</h2>
      <div className="panel" data-tour="capacidad">
        <div className="fgrid">
          <label className="f">Horas por día<input id="c-h" type="number" step="0.5" value={c.horasDia} onChange={(e) => set('horasDia', e.target.value)} /></label>
          <label className="f">Eficiencia real (%)<input id="c-e" type="number" value={c.eficiencia} onChange={(e) => set('eficiencia', e.target.value)} /></label>
        </div>
        <div className="checks">
          <label><input type="checkbox" checked={!!c.sabado} onChange={(e) => set('sabado', e.target.checked)} />Se trabaja los sábados</label>
          <label><input type="checkbox" checked={!!c.medidos} onChange={(e) => set('medidos', e.target.checked)} />Los tiempos ya fueron medidos en el taller</label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Las personas de cada estación se asignan en la pestaña Usuarios. La capacidad = personas × horas × eficiencia.</p>
      </div>

      <h2>Tiempos estándar por pieza (minutos)</h2>
      <div className="panel scroll tt" data-tour="tiempos">
        <table>
          <thead><tr><th>Producto</th><th className="r">Corte</th><th className="r">Costura</th><th className="r">Empaque y revisión</th></tr></thead>
          <tbody>
            {Object.entries(c.productos).map(([k, p]) => (
              <tr key={k}><td>{p.nombre}</td>
                {['corte', 'costura', 'empaque'].map((f) => (
                  <td key={f} className="r"><input id={`t-${k}-${f}`} type="number" step="0.1" aria-label={`${p.nombre} ${f}`} value={p[f]} onChange={(e) => set(`productos.${k}.${f}`, e.target.value)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="formacts">
          <input id="nuevo-prod" style={{ maxWidth: 220 }} placeholder="Nuevo producto (ej. Gorra)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <button className="btn sm" onClick={agregarProducto}>Agregar producto</button>
        </div>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Estampado</th><th className="r">Minutos</th></tr></thead>
          <tbody>
            {DECO_CAMPOS.map(([k, l]) => (
              <tr key={k}><td>{l}</td><td className="r"><input id={`d-${k}`} type="number" step="0.1" aria-label={l} value={c.deco[k]} onChange={(e) => set(`deco.${k}`, e.target.value)} /></td></tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">Cómo medir: cronometra a una persona experimentada haciendo 10 piezas seguidas y divide el tiempo entre 10. Repite con dos personas distintas y usa el promedio.</p>
      </div>
      <div className="formacts">
        <button className="btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>
        <button className="btn" onClick={() => setC(structuredClone(M.cfg))}>Descartar cambios</button>
      </div>
    </>
  );
}
