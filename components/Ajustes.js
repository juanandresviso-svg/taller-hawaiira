'use client';
import { useState } from 'react';
import { cfgBase, estimarProducto, ETAPAS_PROD } from '@/lib/aprendizaje';
import { nf, nf1 } from '@/lib/motor';
import { GenerarClaves } from './Avisos';

const ETAPA_NOMBRE = { corte: 'Corte', costura: 'Costura', empaque: 'Empaque y revisión' };

// Celda de resultado: el tiempo que usa la app y de dónde sale
function Resultado({ d, unidad = 'min/pza' }) {
  if (!d) return <td className="r muted">—</td>;
  return (
    <td className="r" style={{ verticalAlign: 'top' }}>
      <div className="num" style={{ fontWeight: 600, fontSize: 15 }}>{nf1.format(d.usado)} <span className="small muted" style={{ fontWeight: 400 }}>{unidad}</span></div>
      {d.fuente === 'real'
        ? <div className="small muted">promedio de {d.n} pedido{d.n > 1 ? 's' : ''} entregado{d.n > 1 ? 's' : ''} · {nf.format(d.piezas)} {unidad === 'min' ? 'pedidos' : 'pzas'}{d.ultimo ? <><br />último: {d.ultimo.codigo} · {nf1.format(d.ultimo.valor)}</> : null}</div>
        : <div className="small" style={{ color: 'var(--warn)' }}>estimado · sin pedidos entregados</div>}
    </td>
  );
}

export default function Ajustes({ supabase, perfil, config, A, avisar }) {
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
    d.deco.bordadoExternoDias = Math.max(0, +d.deco.bordadoExternoDias || 0);
    const vacio = Object.values(d.productos).find((p) => !String(p.nombre || '').trim());
    if (vacio) return avisar('Hay un producto sin nombre. Escribe un nombre antes de guardar.');
    Object.values(d.productos).forEach((p) => { p.nombre = String(p.nombre).trim(); });
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
    set('productos.' + key, { nombre, ...estimarProducto(A.efectivo, det), estimado: true });
    setNuevo('');
  }

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
          <label className="f">Bordado externo: días hábiles que tarda el aliado<input id="c-bed" type="number" min="0" value={c.deco.bordadoExternoDias} onChange={(e) => set('deco.bordadoExternoDias', e.target.value)} /></label>
        </div>
        <div className="checks">
          <label><input type="checkbox" checked={!!c.sabado} onChange={(e) => set('sabado', e.target.checked)} />Se trabaja los sábados</label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Las personas de cada estación se asignan en Usuarios. La capacidad = personas × horas × eficiencia. La hora de entrada y el almuerzo sirven para medir cuánto tarda cada registro.</p>
      </div>
      <div className="formacts">
        <button className="btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>
        <button className="btn" onClick={() => setC(structuredClone(cfgBase(config)))}>Descartar cambios</button>
      </div>

      <h2>Tiempos de producción (resultado)</h2>
      <div className="panel scroll tt" data-tour="tiempos">
        <p className="small muted" style={{ marginTop: 0 }}>
          Estos tiempos no se escriben: salen de los pedidos entregados. Cada vez que un pedido se marca como entregado, sus minutos reales por pieza entran al promedio (los últimos 6 pedidos de cada producto, sin las mediciones extremas). Mientras un producto no tenga pedidos entregados, la app usa un estimado. Pedidos entregados con tiempos medidos: <b>{A.entregados}</b>.
        </p>
        <table>
          <thead><tr><th>Producto</th>{ETAPAS_PROD.map((s) => <th key={s} className="r">{ETAPA_NOMBRE[s]}</th>)}</tr></thead>
          <tbody>
            {Object.entries(c.productos).map(([k, p]) => (
              <tr key={k}>
                <td style={{ verticalAlign: 'top' }}>
                  <input id={'pn-' + k} aria-label="Nombre del producto" value={p.nombre} onChange={(e) => set(`productos.${k}.nombre`, e.target.value)} style={{ width: 180, textAlign: 'left', fontFamily: 'var(--font)', fontWeight: 600 }} />
                  {p.nombre !== (cfgBase(config).productos[k] || {}).nombre && <div className="small" style={{ color: 'var(--warn)' }}>sin guardar</div>}
                </td>
                {ETAPAS_PROD.map((s) => <Resultado key={s} d={det.productos[k] && det.productos[k][s]} />)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="formacts">
          <input id="nuevo-prod" style={{ maxWidth: 220 }} placeholder="Nuevo producto (ej. Gorra)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <button className="btn sm" onClick={agregarProducto}>Agregar producto</button>
          <span className="small muted">Para cambiar el nombre de un producto, escríbelo en la tabla. Los nombres nuevos y los productos agregados se guardan con el botón de abajo; los pedidos existentes conservan su producto y muestran el nombre nuevo.</span>
        </div>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Estampado</th><th className="r">Tiempo</th></tr></thead>
          <tbody>
            {Object.entries(det.deco).map(([k, d]) => <tr key={k}><td style={{ verticalAlign: 'top' }}>{d.nombre}</td><Resultado d={d} /></tr>)}
            {Object.entries(det.prep).map(([k, d]) => <tr key={k}><td style={{ verticalAlign: 'top' }}>{d.nombre}</td><Resultado d={d} unidad="min" /></tr>)}
          </tbody>
        </table>
        <div className="formacts">
          <button className="btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar nombres y productos'}</button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Para que el resultado sea fiel, el equipo debe registrar cada paquete apenas lo termina (o usar Empezar). El detalle de cada pedido está en su Informe de producción.</p>
      </div>

      {perfil && perfil.rol === 'direccion' && (
        <>
          <h2>Notificaciones push</h2>
          <div className="panel" data-tour="claves">
            <p className="small muted" style={{ marginTop: 0 }}>Para que las notificaciones lleguen aunque la app esté cerrada, el servidor necesita un par de claves propias del taller. Se configuran una sola vez (instructivo, paso 4.5).</p>
            <GenerarClaves />
          </div>
        </>
      )}
    </>
  );
}
