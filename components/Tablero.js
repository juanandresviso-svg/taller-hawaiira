'use client';
import { useState } from 'react';
import { POOLS, POOL_NAME, ROLES_ALERTA, nf, nf1, pct, isoDay, mondayOf } from '@/lib/motor';
import FlujoPedidos from './FlujoPedidos';

const ROL_A_FILTRO = { direccion: 'todas', jefa: 'jefa', diseno: 'diseno', compras: 'compras', admin: 'admin' };
const NIVEL = { temporal: 'Sobrecarga temporal', recurrente: 'Sobrecarga recurrente', estructural: 'Expansión', aviso: 'Cerca del límite', riesgo: 'Riesgo' };

export default function Tablero({ M, perfil, registros, perfiles, ordenes, hitos, cotizaciones, veCostos }) {
  const [rol, setRol] = useState(ROL_A_FILTRO[perfil.rol] || 'todas');
  const act = M.activos;
  const espera = ordenes.filter((o) => o.estado === 'espera');
  const cnt = { rojo: 0, amarillo: 0, verde: 0, listo: 0 };
  act.forEach((o) => cnt[M.status[o.id].est]++);
  const bn = POOLS.filter((p) => M.personas(p) > 0).map((p) => ({ p, u: M.util[p].w10.u })).sort((a, b) => b.u - a.u)[0];
  const filtro = (a) => rol === 'todas' || a.para.includes(rol) || (rol === 'mias' && a.dueno === perfil.id);
  const al = rol === 'mias' ? M.alerts.filter((a) => a.dueno === perfil.id) : M.alerts.filter(filtro);
  const mias = M.alerts.filter((a) => a.dueno === perfil.id).length;

  const lunes = isoDay(mondayOf(M.t0));
  const by = {};
  registros.filter((r) => r.dia >= lunes && r.etapa !== 'preprensa').forEach((r) => {
    const k = r.persona_id || '?'; by[k] = by[k] || { pz: 0, min: 0 };
    by[k].pz += +r.cantidad || 0;
    const o = ordenes.find((x) => x.id === r.orden_id);
    by[k].min += (+r.cantidad || 0) * (o ? M.mpp(o, r.etapa) : 0);
  });
  const filas = Object.entries(by).sort((a, b) => b[1].min - a[1].min);

  return (
    <>
      <h2>Resumen</h2>
      <div className="summary" data-tour="resumen">
        <div><span className="k">Pedidos activos</span><span className="v">{act.length}</span></div>
        <div><span className="k">Entrega en riesgo</span><span className={'v ' + (cnt.rojo ? 'bad' : '')}>{cnt.rojo}</span></div>
        <div><span className="k">Holgura mínima</span><span className={'v ' + (cnt.amarillo ? 'warn' : '')}>{cnt.amarillo}</span></div>
        <div><span className="k">Por enviar la OP</span><span className={'v ' + (espera.length ? 'warn' : '')}>{espera.length}</span></div>
        <div><span className="k">Listos para despachar</span><span className={'v ' + (cnt.listo ? 'info' : '')}>{cnt.listo}</span></div>
        <div><span className="k">Estación más cargada (2 sem.)</span><span className={'v ' + (bn && bn.u > 1 ? 'bad' : bn && bn.u > 0.85 ? 'warn' : 'ok')}>{bn ? pct(bn.u) : '—'} <small>{bn ? POOL_NAME[bn.p] : ''}</small></span></div>
      </div>

      <FlujoPedidos M={M} perfil={perfil} ordenes={ordenes} hitos={hitos} cotizaciones={cotizaciones} veCostos={veCostos} />

      {espera.length > 0 && <div className="banner warn">{espera.length === 1 ? '1 pedido espera' : espera.length + ' pedidos esperan'} que se envíe su orden de producción para entrar en el plan: {espera.map((o) => o.codigo + ' · ' + o.cliente).join(', ')}. Envíala en Pedidos → Por enviar OP.</div>}
      <h2>Alertas</h2>
      <div data-tour="alertas"><div className="chips" role="group" aria-label="Filtrar por responsable">
        <button className="chip" aria-pressed={rol === 'todas'} onClick={() => setRol('todas')}>Todas ({M.alerts.length})</button>
        <button className="chip" aria-pressed={rol === 'mias'} onClick={() => setRol('mias')}>Mis pedidos ({mias})</button>
        {Object.entries(ROLES_ALERTA).filter(([k]) => k !== 'duenos').map(([k, v]) => (
          <button key={k} className="chip" aria-pressed={rol === k} onClick={() => setRol(k)}>{v} ({M.alerts.filter((a) => a.para.includes(k)).length})</button>
        ))}
      </div>
      {al.length ? (
        <div className="list">
          {al.map((a, i) => (
            <div key={i} className={'alert ' + a.sev}><span className="sv" />
              <div><b>{a.t}</b><div className="d">{a.d}</div><div className="who">Para: {a.para.map((r) => ROLES_ALERTA[r]).join(', ')}</div></div>
            </div>
          ))}
        </div>
      ) : <div className="empty">Sin alertas para este filtro.</div>}
      </div>

      <div className="grid2">
        <div>
          <h2>Carga por estación</h2>
          <div className="panel" data-tour="carga"><div className="load">
            {POOLS.filter((p) => M.personas(p) > 0 || M.util[p].total > 0).map((p, i) => {
              const u = M.util[p], v = u.w10.u, cls = v > 1 ? 'bad' : v > 0.85 ? 'warn' : 'ok', n = M.personas(p);
              return (
                <FilaCarga key={p} sep={i > 0} p={p} u={u} v={v} cls={cls} n={n} />
              );
            })}
          </div>
            <div className="legend">Barra: carga de las próximas 2 semanas frente a la capacidad ({M.cfg.horasDia} h/día, {M.cfg.eficiencia}% de eficiencia{M.cfg.sabado ? ', con sábados' : ''}). Las marcas indican 85% y 100%.</div>
          </div>
        </div>
        <div>
          <h2>Recomendaciones</h2>
          <div className="list" data-tour="recomendaciones">
            {M.recs.length ? M.recs.map((r, i) => (
              <div key={i} className={'rec ' + r.nivel}>
                <span className="tag">{NIVEL[r.nivel]}</span>
                <h4>{r.titulo}</h4>
                <ul>{r.ops.map((x, j) => <li key={j}>{x}</li>)}</ul>
              </div>
            )) : <div className="empty">Todas las estaciones están bajo 85% de carga. Hay espacio para aceptar pedidos.</div>}
          </div>
          <p className="small faint">Las recomendaciones de expansión se activan cuando una estación supera el 90% en 4 de las últimas 8 semanas. Semanas en el historial: {M.semanasHistorial}.</p>
        </div>
      </div>

      <h2>Producción de la semana por persona</h2>
      {filas.length ? (
        <div className="panel scroll">
          <table>
            <thead><tr><th>Persona</th><th>Estación</th><th className="r">Piezas</th><th className="r">Min. estándar</th><th className="r">Horas equivalentes</th></tr></thead>
            <tbody>
              {filas.map(([id, v]) => {
                const p = perfiles.find((x) => x.id === id);
                return <tr key={id}><td>{p ? p.nombre : 'Sin nombre'}</td><td className="muted">{p && p.estacion ? POOL_NAME[p.estacion] : '—'}</td><td className="r">{nf.format(v.pz)}</td><td className="r">{nf.format(v.min)}</td><td className="r">{nf1.format(v.min / 60)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">Aún no hay registros de producción esta semana.</div>}
    </>
  );
}

function FilaCarga({ sep, p, u, v, cls, n }) {
  return (
    <>
      {sep && <div className="sep" />}
      <div className="n"><b>{POOL_NAME[p]}</b><span>{n} persona{n === 1 ? '' : 's'} · {u.cola === Infinity ? 'sin capacidad' : nf1.format(u.cola) + ' días de cola'}{u.split ? ` · DTF ${nf.format(u.split.dtf / 60)} h, empaque ${nf.format(u.split.empaque / 60)} h` : ''}</span></div>
      <div className="bar" role="img" aria-label={`${POOL_NAME[p]} ${pct(v)} de capacidad en 2 semanas`}><i className={cls} style={{ width: Math.min(100, (v / 1.25) * 100) + '%' }} /><u style={{ left: '68%' }} /><u style={{ left: '80%' }} /></div>
      <div className="v num"><b>{n ? pct(v) : '—'}</b>1 sem {n ? pct(u.w5.u) : '—'} · 4 sem {n ? pct(u.w20.u) : '—'}</div>
    </>
  );
}
