'use client';
import { useEffect, useState } from 'react';
import { POOLS, POOL_NAME, STAGE_NAME, STAGE_POOL, DECO_NAME, CHECK, fd, parseDay, nf, isoDay } from '@/lib/motor';
import { Pill } from './ui';

function leerCk(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
function guardarCk(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export default function MiTrabajo({ supabase, perfil, M, ordenes, registros, avisar, recargar }) {
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  const pools = perfil.estacion ? [perfil.estacion] : POOLS;
  const hoy = isoDay(M.t0);
  const misHoy = registros.filter((r) => r.persona_id === perfil.id && r.dia === hoy && r.etapa !== 'preprensa').reduce((a, r) => a + (+r.cantidad || 0), 0);

  async function registrar(o, s, cantidad) {
    const q = Math.round(+cantidad);
    if (!(q > 0)) return avisar('Escribe cuántas piezas terminaste.');
    const disp = M.upAvail(o, s);
    if (disp <= 0) return avisar(M.doneOf(o, s) >= M.tot(o, s) ? 'Esa etapa ya está completa.' : 'Todavía no hay piezas listas de la etapa anterior.');
    const real = Math.min(q, disp);
    setBusy(true);
    const { data, error } = await supabase.rpc('registrar_produccion', { p_orden: o.id, p_etapa: s, p_cantidad: real });
    setBusy(false);
    if (error) return avisar('No se pudo registrar: ' + error.message);
    setQty((x) => ({ ...x, [o.id + s]: '' }));
    recargar.ordenes(); recargar.registros();
    const n = data?.registrado || 0;
    const rid = data?.registro_id;
    avisar(s === 'preprensa' ? `Preprensa lista en ${o.codigo}` : `Registrado: ${n} piezas de ${STAGE_NAME[s].toLowerCase()} en ${o.codigo}${real < q ? ` (solo había ${real} disponibles)` : ''}`,
      rid ? async () => {
        const { error: e2 } = await supabase.rpc('deshacer_registro', { p_registro: rid });
        if (e2) avisar('No se pudo deshacer: ' + e2.message); else { avisar('Registro deshecho.'); recargar.ordenes(); recargar.registros(); }
      } : null);
  }

  return (
    <>
      <div className="small muted" style={{ marginBottom: 6 }}>
        {perfil.estacion ? <>Estación: <b style={{ color: 'var(--ink)' }}>{POOL_NAME[perfil.estacion]}</b> · </> : 'Vista general de todas las estaciones · '}
        Registraste hoy: <b className="num" style={{ color: 'var(--ink)' }}>{nf.format(misHoy)}</b> piezas
      </div>
      {pools.map((p) => <Estacion key={p} p={p} M={M} ordenes={ordenes} multi={!perfil.estacion} qty={qty} setQty={setQty} busy={busy} registrar={registrar} />)}
    </>
  );
}

function Estacion({ p, M, ordenes, multi, qty, setQty, busy, registrar }) {
  const plan = M.hoyPlan[p] || [];
  const n = Math.max(1, M.personas(p));
  const seen = new Set(plan.map((x) => x.oid + '|' + x.s));
  const queue = [];
  M.activos.forEach((o) => {
    const st = M.status[o.id];
    M.ruta(o).forEach((s) => {
      if (STAGE_POOL[s] !== p || seen.has(o.id + '|' + s) || M.doneOf(o, s) >= M.tot(o, s)) return;
      queue.push({ oid: o.id, s, start: st.start && st.start[s] });
    });
  });
  queue.sort((a, b) => (a.start ?? 999) - (b.start ?? 999));
  return (
    <section className="station">
      <h2>{POOL_NAME[p]} · plan de hoy</h2>
      {plan.length ? (
        <div className="list">{plan.map((t) => <Tarea key={t.oid + t.s} t={t} n={n} hoy M={M} ordenes={ordenes} qty={qty} setQty={setQty} busy={busy} registrar={registrar} />)}</div>
      ) : <div className="empty">Nada programado hoy en {POOL_NAME[p].toLowerCase()}.</div>}
      {!multi && queue.length > 0 && (
        <>
          <h2>Lo que viene</h2>
          <div className="list">{queue.slice(0, 6).map((t) => <Tarea key={t.oid + t.s} t={t} n={n} M={M} ordenes={ordenes} qty={qty} setQty={setQty} busy={busy} registrar={registrar} />)}</div>
        </>
      )}
    </section>
  );
}

function Tarea({ t, n, hoy, M, ordenes, qty, setQty, busy, registrar }) {
  const o = ordenes.find((x) => x.id === t.oid);
  const s = t.s;
  const ckKey = 'ck:' + isoDay(M.t0) + ':' + t.oid + ':' + s;
  const [ck, setCk] = useState([]);
  useEffect(() => { setCk(leerCk(ckKey)); }, [ckKey]);
  if (!o) return null;
  const T = M.tot(o, s), dn = M.doneOf(o, s), d = o.deco || {}, disp = M.upAvail(o, s);
  const goal = hoy && s !== 'preprensa' ? Math.round(t.pzas / n) : null;
  const k = o.id + s;
  const deps = M.deps(o, s).filter((x) => M.ruta(o).includes(x));
  const toggle = (i, on) => { const v = on ? [...new Set([...ck, i])] : ck.filter((x) => x !== i); setCk(v); guardarCk(ckKey, v); };

  return (
    <div className="task">
      <div className="top"><span className="stage">{STAGE_NAME[s]}</span><span className="code">{o.codigo}</span><b>{o.cliente}</b><Pill M={M} o={o} /></div>
      <div className="small muted">
        {M.prod(o).nombre} × {nf.format(o.cantidad)}
        {d.tipo && d.tipo !== 'ninguna' ? ` · ${DECO_NAME[d.tipo]}${d.tipo === 'serigrafia' ? ` ${d.colores || 1} col.` : ''}` : ''}
        {o.tallas ? ` · ${o.tallas}` : ''} · Entrega {fd(parseDay(o.fechaCompromiso))}
      </div>
      {s === 'preprensa' ? (
        <div className="prog">
          {dn >= 1 ? <span className="pill verde">Lista</span> : <span className="pill amarillo">Pendiente</span>}
          {!o.arteAprobado && <span className="small" style={{ color: 'var(--warn)' }}>Falta la aprobación del arte</span>}
        </div>
      ) : (
        <div className="prog"><div className="bar"><i style={{ width: (T ? (dn / T) * 100 : 0) + '%' }} /></div><span className="num"><b>{nf.format(dn)}</b> / {nf.format(T)}</span></div>
      )}
      {s !== 'preprensa' && dn < T && disp > 0 && disp < T - dn && <div className="small muted">Disponibles para trabajar ahora: <b className="num">{nf.format(disp)}</b></div>}
      {goal ? <div className="goal">Meta de hoy: <b className="num">{nf.format(goal)}</b> piezas{n > 1 ? ' por persona' : ''}</div>
        : !hoy && t.start != null ? <div className="small muted">Programado desde {fd(M.days[t.start])}</div> : null}
      <details className="ck">
        <summary>Recordatorios de {STAGE_NAME[s].toLowerCase()} ({ck.length}/{CHECK[s].length})</summary>
        <ul>{CHECK[s].map((x, i) => <li key={i}><label><input type="checkbox" checked={ck.includes(i)} onChange={(e) => toggle(i, e.target.checked)} />{x}</label></li>)}</ul>
      </details>
      {dn < T && disp <= 0 && <div className="small muted">Esperando piezas de {deps.map((x) => STAGE_NAME[x].toLowerCase()).join(' y ')}.</div>}
      {dn < T && disp > 0 && (s === 'preprensa' ? (
        <div className="reg"><button className="btn primary" disabled={busy} onClick={() => registrar(o, s, 1)}>Marcar preprensa lista</button></div>
      ) : (
        <div className="reg">
          <input id={'q-' + k} type="number" min="1" inputMode="numeric" placeholder="Piezas" aria-label="Piezas terminadas" value={qty[k] || ''} onChange={(e) => setQty((x) => ({ ...x, [k]: e.target.value }))} />
          <button className="btn" onClick={() => setQty((x) => ({ ...x, [k]: String((+x[k] || 0) + 10) }))}>+10</button>
          <button className="btn" onClick={() => setQty((x) => ({ ...x, [k]: String((+x[k] || 0) + 25) }))}>+25</button>
          <button className="btn primary" disabled={busy} onClick={() => registrar(o, s, qty[k])}>Registrar</button>
        </div>
      ))}
    </div>
  );
}
