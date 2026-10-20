'use client';
import { useState } from 'react';
import { cfgBase, estimarProducto } from '@/lib/aprendizaje';
import { nf, nf1, pct } from '@/lib/motor';

const ETAPAS = [['corte', 'Corte'], ['costura', 'Costura'], ['empaque', 'Empaque y revisión']];
const DECO_APRENDE = [['serigrafiaColor', 'Serigrafía: por pieza, color y ubicación'], ['dtfUbicacion', 'DTF o vinil: por pieza y ubicación'], ['bordadoUbicacion', 'Bordado interno: por pieza y ubicación']];
const DECO_FIJOS = [
  ['prepBase', 'Preprensa serigrafía: base por pedido'],
  ['prepColor', 'Preprensa serigrafía: adicional por color'],
  ['prepDtf', 'Preprensa DTF o vinil: por ubicación'],
  ['prepBordado', 'Ponchado (archivo de bordado): por ubicación'],
  ['bordadoExternoDias', 'Bordado externo: días hábiles que tarda el aliado'],
];

// Celda con el tiempo en uso, el configurado y lo que dice la producción real
function Tiempo({ id, conf, d, onChange }) {
  const fuente = !d || !d.n ? 'sin datos reales' : d.w >= 1 ? 'aprendido' : `aprendiendo ${pct(d.w)}`;
  return (
    <td className="r" style={{ verticalAlign: 'top' }}>
      <div className="num" style={{ fontWeight: 600, fontSize: 15 }}>{nf1.format(d ? d.usado : conf)} min</div>
      <div className="small muted">{d && d.n ? `real ${nf1.format(d.real)} · ${d.n} pedido${d.n > 1 ? 's' : ''}, ${nf.format(d.piezas)} pzas` : fuente}</div>
      <label className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
        base <input id={id} type="number" step="0.1" min="0" aria-label="Tiempo base" value={conf} onChange={(e) => onChange(e.target.value)} />
      </label>
    </td>
  );
}

export default function Ajustes({ supabase, config, A, avisar }) {
  const [c, setC] = useState(() => structuredClone(cfgBase(config)));
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const set = (path, val) => setC((d) => { const n = structuredClone(d); const ks = path.split('.'); let o = n; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; return n; });
  const det = A.detalle;

  async function guardar() {
    const d = structuredClone(c);
    d.horasDia = Math.max(1, +d.horasDia || 8);
    d.eficiencia = Math.min(100, Math.max(10, +d.eficiencia || 85));
    d.almuerzoMin = Math.max(0, +d.almuerzoMin || 0);
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
    const key = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (c.productos[key]) return avisar('Ese producto ya existe.');
    set('productos.' + key, { nombre, ...estimarProducto(A.efectivo), estimado: true });
    setNuevo('');
  }
  // Si alguien escribe un tiempo para un producto estimado, deja de ser estimado
  const setTiempo = (k, f, v) => setC((d) => { const n = structuredClone(d); n.productos[k][f] = v; n.productos[k].estimado = false; return n; });

  return (
    <>
      <h2>Capacidad y jornada</h2>
      <div className="panel" data-tour="capacidad">
        <div className="fgrid">
          <label className="f">Horas por día<input id="c-h" type="number" step="0.5" value={c.horasDia} onChange={(e) => set('horasDia', e.target.value)} /></label>
          <label className="f">Eficiencia real (%)<input id="c-e" type="number" value={c.eficiencia} onChange={(e) => set('eficiencia', e.target.value)} /></label>
          <label className="f">Hora de entrada<input id="c-hi" type="time" value={c.horaInicio} onChange={(e) => set('horaInicio', e.target.value)} /></label>
          <label className="f">Almuerzo desde<input id="c-ai" type="time" value={c.almuerzoInicio} onChange={(e) => set('almuerzoInicio', e.target.value)} /></label>
          <label className="f">Minutos de almuerzo<input id="c-am" type="number" min="0" value={c.almuerzoMin} onChange={(e) => set('almuerzoMin', e.target.value)} /></label>
        </div>
        <div className="checks">
          <label><input type="checkbox" checked={!!c.sabado} onChange={(e) => set('sabado', e.target.checked)} />Se trabaja los sábados</label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Las personas de cada estación se asignan en Usuarios. La capacidad = personas × horas × eficiencia. La hora de entrada y el almuerzo sirven para medir cuánto tardó cada registro.</p>
      </div>

      <h2>Tiempos de producción por pieza</h2>
      <div className="panel scroll tt" data-tour="tiempos">
        <div className="checks" style={{ marginTop: 0, marginBottom: 10 }}>
          <label><input type="checkbox" checked={c.aprendizaje !== false} onChange={(e) => set('aprendizaje', e.target.checked)} />Ajustar los tiempos automáticamente con la producción real</label>
        </div>
        <table>
          <thead><tr><th>Producto</th>{ETAPAS.map(([k, l]) => <th key={k} className="r">{l}</th>)}</tr></thead>
          <tbody>
            {Object.entries(c.productos).map(([k, p]) => (
              <tr key={k}>
                <td style={{ verticalAlign: 'top' }}><b>{p.nombre}</b>{p.estimado && <div><span className="pill amarillo">tiempos estimados</span></div>}</td>
                {ETAPAS.map(([f]) => <Tiempo key={f} id={`t-${k}-${f}`} conf={p[f]} d={det.productos[k] && det.productos[k][f]} onChange={(v) => setTiempo(k, f, v)} />)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="formacts">
          <input id="nuevo-prod" style={{ maxWidth: 220 }} placeholder="Nuevo producto (ej. Gorra)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <button className="btn sm" onClick={agregarProducto}>Agregar producto</button>
        </div>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Estampado</th><th className="r">Tiempo</th></tr></thead>
          <tbody>
            {DECO_APRENDE.map(([k, l]) => <tr key={k}><td style={{ verticalAlign: 'top' }}>{l}</td><Tiempo id={`d-${k}`} conf={c.deco[k]} d={det.deco[k]} onChange={(v) => set(`deco.${k}`, v)} /></tr>)}
            {DECO_FIJOS.map(([k, l]) => <tr key={k}><td>{l}</td><td className="r"><input id={`d-${k}`} type="number" step="0.1" aria-label={l} value={c.deco[k]} onChange={(e) => set(`deco.${k}`, e.target.value)} /></td></tr>)}
          </tbody>
        </table>
        <p className="small muted">El número grande es el tiempo que usa la app para planificar. Sale de mezclar el tiempo base con lo medido en los últimos 6 pedidos: cuantas más piezas registradas, más pesa lo real (con 200 piezas, o 50 en un producto nuevo, se usa solo lo real). Las mediciones muy fuera de lo normal se descartan. Para que lo medido sea preciso, el equipo debe registrar cada paquete apenas lo termina o usar el botón Empezar.</p>
      </div>
      <div className="formacts">
        <button className="btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>
        <button className="btn" onClick={() => setC(structuredClone(cfgBase(config)))}>Descartar cambios</button>
      </div>
    </>
  );
}
