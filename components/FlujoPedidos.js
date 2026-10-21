'use client';
import Seccion from './Seccion';
import { FASES, TOTAL_PASOS, pasosDe, cotizacionDe, puedeMarcar } from '@/lib/proceso';
import { fd, parseDay } from '@/lib/motor';

// Tablero: en qué fase está cada pedido y qué pasos le tocan a cada cargo
export default function FlujoPedidos({ M, perfil, ordenes, hitos = [], cotizaciones = [], veCostos }) {
  const hitosDe = {}, hitosCotDe = {};
  hitos.forEach((h) => { if (h.orden_id) (hitosDe[h.orden_id] = hitosDe[h.orden_id] || []).push(h); if (h.cotizacion_id) (hitosCotDe[h.cotizacion_id] = hitosCotDe[h.cotizacion_id] || []).push(h); });
  const seg = ordenes.map((o) => ({ o, S: pasosDe(o, { M, hitos: hitosDe[o.id] || [], hitosCot: hitosCotDe[o.cotizacionId] || [], cot: veCostos ? cotizacionDe(o, cotizaciones) : undefined }) })).filter((x) => !x.S.cerrado);
  const porFase = FASES.map((f, i) => seg.filter((x) => x.S.fase === i && x.o.estado !== 'entregado').length);
  const porCobrar = seg.filter((x) => x.o.estado === 'entregado').length;

  // Pasos que alguien tiene que hacer ahora (los automáticos dependen de la producción, no de una persona)
  const esDir = perfil.rol === 'direccion';
  const tareas = [];
  seg.forEach(({ o, S }) => S.lista.filter((p) => p.accionable).forEach((p) => {
    // Automáticos que dependen de una persona: enviar la OP (paso 14) y entregar cuando ya está empacado (26)
    const delDueno = p.k === 'p14' || (p.k === 'p26' && S.por.p24.hecho);
    if ((p.modo === 'auto' || p.modo === 'espejo') && !delDueno) return;
    if (p.nivel === 'cot') return;
    const mio = esDir || (delDueno ? o.responsableId === perfil.id : puedeMarcar(p, perfil, o));
    if (mio) tareas.push({ o, p });
  }));
  tareas.sort((a, b) => String(a.o.fechaCompromiso || '').localeCompare(String(b.o.fechaCompromiso || '')));
  const grupos = {};
  tareas.forEach((t) => { const g = esDir ? t.p.cargo : 'mias'; (grupos[g] = grupos[g] || []).push(t); });

  return (
    <Seccion id="tablero:flujo" titulo="Flujo de pedidos" resumen={`${tareas.length} paso${tareas.length === 1 ? '' : 's'} pendiente${tareas.length === 1 ? '' : 's'}`}>
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
                <li key={o.id + p.k}><span className="code">{o.codigo}</span> {o.cliente} · <span className="small muted">paso {p.n}/{TOTAL_PASOS}</span> <b>{p.k === 'p14' ? 'Enviar la orden de producción' : p.nombre}</b> <span className="small muted">· compromiso {fd(parseDay(o.fechaCompromiso))}</span></li>
              ))}
              {ts.length > 12 && <li className="small muted">y {ts.length - 12} más en Pedidos</li>}
            </ul>
          </div>
        )) : <p className="small muted" style={{ margin: '6px 0 0' }}>No hay pasos pendientes{esDir ? '' : ' para tu cargo'}. Se marcan en Pedidos → Seguimiento.</p>}
      </div>
    </Seccion>
  );
}
