'use client';
import { revisarNovedades } from '@/lib/avisos';
import { useEffect, useState } from 'react';
import { POOLS, POOL_NAME, STAGE_NAME, STAGE_POOL, DECO_NAME, CHECK, fd, parseDay, nf, isoDay } from '@/lib/motor';
import { Pill, decoTexto } from './ui';

function leerCk(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
function guardarCk(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export default function MiTrabajo({ supabase, perfil, M, ordenes, registros, perfiles, avisar, recargar }) {
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  const pools = perfil.estacion ? [perfil.estacion] : POOLS;
  const hoy = isoDay(M.t0);
  const kIni = 'inicios:' + perfil.id;
  const [inicios, setInicios] = useState({});
  useEffect(() => { try { setInicios(JSON.parse(localStorage.getItem(kIni) || '{}')); } catch {} }, [kIni]);
  const fijarInicio = (key, iso) => setInicios((x) => { const n = { ...x }; if (iso) n[key] = iso; else delete n[key]; try { localStorage.setItem(kIni, JSON.stringify(n)); } catch {} return n; });
  const timer = { inicios, fijarInicio };
  const misHoy = registros.filter((r) => r.persona_id === perfil.id && r.dia === hoy && r.etapa !== 'preprensa').reduce((a, r) => a + (+r.cantidad || 0), 0);

  async function registrar(o, s, cantidad) {
    const q = Math.round(+cantidad);
    if (!(q > 0)) return avisar('Escribe cuántas piezas terminaste.');
    const disp = M.upAvail(o, s);
    if (disp <= 0) return avisar(M.doneOf(o, s) >= M.tot(o, s) ? 'Esa etapa ya está completa.' : 'Todavía no hay piezas listas de la etapa anterior.');
    const real = Math.min(q, disp);
    setBusy(true);
    const key = o.id + '|' + s, ini = inicios[key];
    const { data, error } = await supabase.rpc('registrar_produccion', { p_orden: o.id, p_etapa: s, p_cantidad: real, p_inicio: ini || null });
    setBusy(false);
    if (error) return avisar('No se pudo registrar: ' + error.message);
    setQty((x) => ({ ...x, [o.id + s]: '' }));
    recargar.ordenes(); recargar.registros(); revisarNovedades();
    if (ini) fijarInicio(key, M.doneOf(o, s) + real >= M.tot(o, s) ? null : new Date().toISOString()); // sigue contando el siguiente paquete
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
      {pools.map((p, k) => <Estacion key={p} primera={k === 0} p={p} M={M} ordenes={ordenes} multi={!perfil.estacion} qty={qty} setQty={setQty} busy={busy} registrar={registrar} timer={timer} />)}
      {['direccion', 'jefa'].includes(perfil.rol) && (
        <Recientes supabase={supabase} registros={registros} ordenes={ordenes} perfiles={perfiles} avisar={avisar} recargar={recargar} />
      )}
    </>
  );
}

function Estacion({ primera, p, M, ordenes, multi, qty, setQty, busy, registrar, timer }) {
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
  const externos = queue.filter((t) => { const o = ordenes.find((x) => x.id === t.oid); return o && M.externo(o, t.s); });
  const internos = queue.filter((t) => !externos.includes(t));
  if (p === 'bordado' && !plan.length && !queue.length && M.personas(p) === 0) return null;
  return (
    <section className="station">
      <h2 data-tour={primera ? 'plan' : undefined}>{POOL_NAME[p]} · plan de hoy</h2>
      {plan.length ? (
        <div className="list">{plan.map((t, j) => <Tarea key={t.oid + t.s} primera={primera && j === 0} t={t} n={n} hoy M={M} ordenes={ordenes} qty={qty} setQty={setQty} busy={busy} registrar={registrar} timer={timer} />)}</div>
      ) : <div className="empty">Nada programado hoy en {POOL_NAME[p].toLowerCase()}.</div>}
      {externos.length > 0 && (
        <>
          <h2>Bordado externo · taller aliado</h2>
          <div className="list">{externos.map((t) => <Tarea key={t.oid + t.s} t={t} n={n} M={M} ordenes={ordenes} qty={qty} setQty={setQty} busy={busy} registrar={registrar} timer={timer} />)}</div>
        </>
      )}
      {!multi && internos.length > 0 && (
        <>
          <h2 data-tour="viene">Lo que viene</h2>
          <div className="list">{internos.slice(0, 6).map((t) => <Tarea key={t.oid + t.s} t={t} n={n} M={M} ordenes={ordenes} qty={qty} setQty={setQty} busy={busy} registrar={registrar} timer={timer} />)}</div>
        </>
      )}
    </section>
  );
}

function Tarea({ primera, t, n, hoy, M, ordenes, qty, setQty, busy, registrar, timer }) {
  const o = ordenes.find((x) => x.id === t.oid);
  const s = t.s;
  const ckKey = 'ck:' + isoDay(M.t0) + ':' + t.oid + ':' + s;
  const [ck, setCk] = useState([]);
  useEffect(() => { setCk(leerCk(ckKey)); }, [ckKey]);
  if (!o) return null;
  const T = M.tot(o, s), dn = M.doneOf(o, s), d = o.deco || {}, disp = M.upAvail(o, s);
  const ext = M.externo(o, s);
  const finExt = ext && M.status[o.id] && M.status[o.id].fin ? M.status[o.id].fin[s] : null;
  const goal = hoy && s !== 'preprensa' && !ext ? Math.round(t.pzas / n) : null;
  const k = o.id + s;
  const deps = M.deps(o, s).filter((x) => M.ruta(o).includes(x));
  const toggle = (i, on) => { const v = on ? [...new Set([...ck, i])] : ck.filter((x) => x !== i); setCk(v); guardarCk(ckKey, v); };

  return (
    <div className="task" data-tour={primera ? 'tarea' : undefined}>
      <div className="top"><span className="stage">{STAGE_NAME[s]}</span><span className="code">{o.codigo}</span><b>{o.cliente}</b><Pill M={M} o={o} /></div>
      <div className="small muted">
        {M.prod(o).nombre} × {nf.format(o.cantidad)}
        {` · ${decoTexto(d)}`}
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
      {ext && <div className="goal">Lo borda el taller aliado. {disp > 0 ? `Hay ${nf.format(disp)} piezas listas para enviar. ` : ''}Regreso estimado: <b>{finExt != null && finExt >= 0 ? fd(M.days[finExt]) : '—'}</b>. Registra aquí las piezas cuando vuelvan.</div>}
      {goal ? <div className="goal" data-tour={primera ? 'meta' : undefined}>Meta de hoy: <b className="num">{nf.format(goal)}</b> piezas{n > 1 ? ' por persona' : ''}</div>
        : !hoy && t.start != null ? <div className="small muted">Programado desde {fd(M.days[t.start])}</div> : null}
      <details className="ck" data-tour={primera ? 'recordatorios' : undefined}>
        <summary>Recordatorios de {STAGE_NAME[s].toLowerCase()} ({ck.length}/{CHECK[s].length})</summary>
        <ul>{CHECK[s].map((x, i) => <li key={i}><label><input type="checkbox" checked={ck.includes(i)} onChange={(e) => toggle(i, e.target.checked)} />{x}</label></li>)}</ul>
      </details>
      {dn < T && disp <= 0 && <div className="small muted">Esperando piezas de {deps.map((x) => STAGE_NAME[x].toLowerCase()).join(' y ')}.</div>}
      {dn < T && disp > 0 && (s === 'preprensa' ? (
        <div className="reg"><button className="btn primary" disabled={busy} onClick={() => registrar(o, s, 1)}>Marcar preprensa lista</button></div>
      ) : (
        <div className="reg" data-tour={primera ? 'registrar' : undefined}>
          {!ext && timer && (timer.inicios[o.id + '|' + s]
            ? <button type="button" className="btn" title="Pausar el cronómetro" onClick={() => timer.fijarInicio(o.id + '|' + s, null)}>⏱ desde {new Date(timer.inicios[o.id + '|' + s]).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })} · Pausar</button>
            : <button type="button" className="btn" data-tour={primera ? 'empezar' : undefined} onClick={() => timer.fijarInicio(o.id + '|' + s, new Date().toISOString())}>Empezar</button>)}
          <input id={'q-' + k} type="number" min="1" inputMode="numeric" placeholder="Piezas" aria-label="Piezas terminadas" value={qty[k] || ''} onChange={(e) => setQty((x) => ({ ...x, [k]: e.target.value }))} />
          <button className="btn" onClick={() => setQty((x) => ({ ...x, [k]: String((+x[k] || 0) + 10) }))}>+10</button>
          <button className="btn" onClick={() => setQty((x) => ({ ...x, [k]: String((+x[k] || 0) + 25) }))}>+25</button>
          <button className="btn primary" disabled={busy} onClick={() => registrar(o, s, qty[k])}>{ext ? 'Registrar recibidas' : 'Registrar'}</button>
        </div>
      ))}
    </div>
  );
}

function Recientes({ supabase, registros, ordenes, perfiles, avisar, recargar }) {
  const [confirm, setConfirm] = useState(null);
  const lista = registros.slice(0, 40);
  const hora = new Intl.DateTimeFormat('es-VE', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
  async function deshacer(id) {
    setConfirm(null);
    const { error } = await supabase.rpc('deshacer_registro', { p_registro: id });
    if (error) avisar('No se pudo deshacer: ' + error.message);
    else { avisar('Registro deshecho.'); recargar.ordenes(); recargar.registros(); }
  }
  return (
    <section className="station">
      <h2 data-tour="recientes">Registros recientes · corregir</h2>
      {lista.length ? (
        <div className="panel scroll">
          <table>
            <thead><tr><th>Cuándo</th><th>Persona</th><th>Pedido</th><th>Etapa</th><th className="r">Piezas</th><th></th></tr></thead>
            <tbody>
              {lista.map((r) => {
                const o = ordenes.find((x) => x.id === r.orden_id), p = perfiles.find((x) => x.id === r.persona_id);
                return (
                  <tr key={r.id}>
                    <td className="small muted">{hora.format(new Date(r.ts))}</td>
                    <td>{p ? p.nombre : '—'}</td>
                    <td className="mono">{o ? o.codigo : '—'}</td>
                    <td>{STAGE_NAME[r.etapa]}</td>
                    <td className="r">{nf.format(r.cantidad)}</td>
                    <td className="r">{confirm === r.id ? (
                      <><button className="btn sm danger" onClick={() => deshacer(r.id)}>Sí, deshacer</button> <button className="btn sm" onClick={() => setConfirm(null)}>No</button></>
                    ) : <button className="btn sm" onClick={() => setConfirm(r.id)}>Deshacer</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">Aún no hay registros.</div>}
    </section>
  );
}
