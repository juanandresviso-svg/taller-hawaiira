'use client';
import { FASES, pasosDe, cotizacionDe, puedeMarcar } from '@/lib/proceso';
import { fd, parseDay } from '@/lib/motor';

// Tablero: en qué fase está cada pedido y qué pasos le tocan a cada cargo
export default function FlujoPedidos({ M, perfil, ordenes, hitos = [], cotizaciones = [], veCostos }) {
  const hitosDe = {};
  hitos.forEach((h) => { if (h.orden_id) (hitosDe[h.orden_id] = hitosDe[h.orden_id] || []).push(h); });
  const seg = ordenes.map((o) => ({ o, S: pasosDe(o, { M, hitos: hitosDe[o.id] || [], cot: veCostos ? cotizacionDe(o, cotizaciones) : undefined }) })).filter((x) => !x.S.cerrado);
  const porFase = FASES.map((f, i) => seg.filter((x) => x.S.fase === i && x.o.estado !== 'entregado').length);
  const porCobrar = seg.filter((x) => x.o.estado === 'entregado').length;

  // Pasos que alguien tiene que hacer ahora (los automáticos dependen de la producción, no de una persona)
  const esDir = perfil.rol === 'direccion';
  const tareas = [];
  seg.forEach(({ o, S }) => S.lista.filter((p) => p.accionable).forEach((p) => {
    const delDueno = p.k === 'oc' || (p.k === 'entrega' && S.lista.find((x) => x.k === 'empaque').hecho);
    if (p.modo === 'auto' && !delDueno) return;
    const mio = esDir || (p.modo === 'auto' ? o.responsableId === perfil.id : puedeMarcar(p, perfil.rol));
    if (mio) tareas.push({ o, p });
  }));
  tareas.sort((a, b) => String(a.o.fechaCompromiso || '').localeCompare(String(b.o.fechaCompromiso || '')));
  const grupos = {};
  tareas.forEach((t) => { const g = esDir ? t.p.cargo : 'mias'; (grupos[g] = grupos[g] || []).push(t); });

  return (
    <>
      <h2>Flujo de pedidos</h2>
      <div className="summary" data-tour="flujo">
        {FASES.map((f, i) => (
          <div key={f}><span className="k">{i + 1} · {f}</span><span className="v">{porFase[i]}</span></div>
        ))}
        <div><span className="k">Entregados por cobrar</span><span className={'v ' + (porCobrar ? 'warn' : '')}>{porCobrar}</span></div>
      </div>
      <div className="panel flujo" style={{ marginTop: 10 }}>
        <b>{esDir ? 'Pasos pendientes por cargo' : 'Pasos que te tocan'}</b>
        {tareas.length ? Object.entries(grupos).map(([g, ts]) => (
          <div key={g} className="grupo">
            {esDir && <div className="small muted" style={{ fontWeight: 600, marginTop: 8 }}>{g} ({ts.length})</div>}
            <ul>
              {ts.slice(0, 12).map(({ o, p }) => (
                <li key={o.id + p.k}><span className="code">{o.codigo}</span> {o.cliente} · <b>{p.nombre}</b> <span className="small muted">· compromiso {fd(parseDay(o.fechaCompromiso))}</span></li>
              ))}
              {ts.length > 12 && <li className="small muted">y {ts.length - 12} más en Pedidos</li>}
            </ul>
          </div>
        )) : <p className="small muted" style={{ margin: '6px 0 0' }}>No hay pasos pendientes{esDir ? '' : ' para tu cargo'}. Se marcan en Pedidos → Seguimiento.</p>}
      </div>
    </>
  );
}
