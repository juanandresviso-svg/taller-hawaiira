'use client';
import { useState } from 'react';
import { DECO_NAME, STAGE_NAME, fd, parseDay, nf, pct, ordenADb } from '@/lib/motor';
import { Pill } from './ui';

const EDITAN = ['direccion', 'jefa', 'admin', 'compras', 'diseno'];

function nuevoCodigo(ordenes) {
  let m = 0;
  ordenes.forEach((o) => { const n = parseInt(String(o.codigo || '').replace(/\D/g, ''), 10); if (n > m) m = n; });
  return 'OP-' + String(m + 1).padStart(4, '0');
}

export default function Pedidos({ supabase, perfil, M, ordenes, perfiles, avisar }) {
  const [filtro, setFiltro] = useState('activos');
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const puede = EDITAN.includes(perfil.rol);

  let list = ordenes.slice();
  if (filtro === 'activos') list = list.filter((o) => o.estado !== 'entregado');
  else if (filtro === 'entregados') list = list.filter((o) => o.estado === 'entregado');
  const rank = { rojo: 0, amarillo: 1, verde: 2, listo: 3, entregado: 4 };
  list.sort((a, b) => (rank[M.status[a.id]?.est] - rank[M.status[b.id]?.est]) || (a.fechaCompromiso || '').localeCompare(b.fechaCompromiso || ''));

  async function run(fn, ok) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { avisar('No se pudo guardar: ' + (error.message || 'revisa la conexión.')); return false; }
    if (ok) avisar(ok);
    return true;
  }

  function set(path, val) {
    setDraft((d) => { const n = structuredClone(d); const ks = path.split('.'); let o = n; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; return n; });
  }

  async function guardar(e) {
    e.preventDefault();
    const q = Math.round(+draft.cantidad);
    if (!String(draft.cliente || '').trim()) return setErr('Escribe el nombre del cliente.');
    if (!(q > 0)) return setErr('La cantidad debe ser mayor que cero.');
    if (!draft.fechaCompromiso) return setErr('Indica la fecha comprometida con el cliente.');
    const body = ordenADb({
      ...draft, cliente: String(draft.cliente).trim(), cantidad: q, monto: +draft.monto || 0,
      deco: { tipo: draft.deco.tipo || 'ninguna', colores: Math.max(1, +draft.deco.colores || 1), ubicaciones: Math.max(1, +draft.deco.ubicaciones || 1) },
    });
    const ok = draft.id
      ? await run(() => supabase.from('ordenes').update(body).eq('id', draft.id), 'Pedido actualizado.')
      : await run(() => supabase.from('ordenes').insert({ ...body, creado_por: perfil.id }), 'Pedido creado.');
    if (ok) { setDraft(null); setErr(''); }
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {[['activos', 'Activos'], ['entregados', 'Entregados'], ['todos', 'Todos']].map(([k, v]) => (
            <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{v}</button>
          ))}
        </div>
        {puede && <button className="btn primary" onClick={() => { setErr(''); setDraft({ codigo: nuevoCodigo(ordenes), cliente: '', responsableId: perfil.id, producto: 'franela', cantidad: '', tallas: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 }, fechaCompromiso: '', monto: '', notas: '', arteAprobado: false, materialListo: false, anticipo: false }); window.scrollTo(0, 0); }}>Nuevo pedido</button>}
      </div>

      {draft && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={guardar} noValidate>
          <h3 style={{ marginBottom: 12 }}>{draft.id ? 'Editar ' + draft.codigo : 'Nuevo pedido · ' + draft.codigo}</h3>
          <div className="fgrid">
            <label className="f">Cliente<input id="f-cliente" value={draft.cliente} onChange={(e) => set('cliente', e.target.value)} autoComplete="off" /></label>
            <label className="f">Dueño del pedido
              <select id="f-resp" value={draft.responsableId || ''} onChange={(e) => set('responsableId', e.target.value)}>
                <option value="">—</option>
                {perfiles.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="f">Producto
              <select id="f-prod" value={draft.producto} onChange={(e) => set('producto', e.target.value)}>
                {Object.entries(M.cfg.productos).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="f">Cantidad<input id="f-cant" type="number" min="1" inputMode="numeric" value={draft.cantidad} onChange={(e) => set('cantidad', e.target.value)} /></label>
            <label className="f">Tallas<input id="f-tallas" placeholder="S 50 · M 120 · L 100" value={draft.tallas} onChange={(e) => set('tallas', e.target.value)} /></label>
            <label className="f">Estampado
              <select id="f-deco" value={draft.deco.tipo} onChange={(e) => set('deco.tipo', e.target.value)}>
                {Object.entries(DECO_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="f">Colores (serigrafía)<input id="f-col" type="number" min="1" value={draft.deco.colores} onChange={(e) => set('deco.colores', e.target.value)} /></label>
            <label className="f">Ubicaciones<input id="f-ub" type="number" min="1" value={draft.deco.ubicaciones} onChange={(e) => set('deco.ubicaciones', e.target.value)} /></label>
            <label className="f">Fecha comprometida<input id="f-fecha" type="date" value={draft.fechaCompromiso || ''} onChange={(e) => set('fechaCompromiso', e.target.value)} /></label>
            <label className="f">Monto (US$)<input id="f-monto" type="number" min="0" value={draft.monto} onChange={(e) => set('monto', e.target.value)} /></label>
          </div>
          <label className="f" style={{ marginTop: 12 }}>Notas<textarea id="f-notas" rows={2} value={draft.notas} onChange={(e) => set('notas', e.target.value)} /></label>
          <div className="checks">
            <label><input type="checkbox" checked={!!draft.arteAprobado} onChange={(e) => set('arteAprobado', e.target.checked)} />Arte aprobado</label>
            <label><input type="checkbox" checked={!!draft.materialListo} onChange={(e) => set('materialListo', e.target.checked)} />Material listo</label>
            <label><input type="checkbox" checked={!!draft.anticipo} onChange={(e) => set('anticipo', e.target.checked)} />Anticipo recibido</label>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="formacts">
            <button className="btn primary" type="submit" disabled={busy}>{draft.id ? 'Guardar cambios' : 'Crear pedido'}</button>
            <button className="btn" type="button" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {list.length ? (
        <div className="list">
          {list.map((o) => {
            const s = M.status[o.id] || {}, r = M.ruta(o), cs = M.curStage(o), d = o.deco || {}, ent = o.estado === 'entregado';
            const deco = d.tipo && d.tipo !== 'ninguna' ? `${DECO_NAME[d.tipo]}${d.tipo === 'serigrafia' ? ` ${d.colores || 1} color${(+d.colores || 1) > 1 ? 'es' : ''}` : ''} · ${d.ubicaciones || 1} ubicación${(+d.ubicaciones || 1) > 1 ? 'es' : ''}` : 'Sin estampado';
            const cf = confirm && confirm.id === o.id ? confirm.a : null;
            const dueno = M.nombreDe(o.responsableId);
            return (
              <article key={o.id} className="op">
                <div className="h"><span className="code">{o.codigo}</span><span className="cli">{o.cliente}</span><Pill M={M} o={o} /></div>
                <div className="meta">{M.prod(o).nombre} × <b className="num">{nf.format(o.cantidad)}</b> · {deco}{o.tallas ? ` · Tallas ${o.tallas}` : ''}{dueno ? ` · Dueño: ${dueno}` : ''}</div>
                <div className="route">
                  {r.map((sg) => {
                    const dn = M.doneOf(o, sg), T = M.tot(o, sg), f = T ? dn / T : 0;
                    return (
                      <div key={sg} className={'stg' + (f >= 1 ? ' done' : '') + (sg === cs && !ent ? ' cur' : '')}>
                        <i style={{ width: f * 100 + '%' }} />
                        <span><b>{STAGE_NAME[sg]}</b><span className="num">{sg === 'preprensa' ? (f >= 1 ? 'Lista' : 'Pend.') : pct(f)}</span></span>
                      </div>
                    );
                  })}
                </div>
                <div className="dates">
                  <span>Compromiso: <b>{fd(parseDay(o.fechaCompromiso))}</b></span>
                  {!ent && s.endDate && <span>Proyectada: <b>{fd(s.endDate)}</b></span>}
                  {o.monto ? <span>Monto: <b className="num">US$ {nf.format(o.monto)}</b></span> : null}
                  {ent && o.entregado && <span>Entregado: <b>{fd(new Date(o.entregado))}</b></span>}
                </div>
                {o.notas && <div className="small muted">{o.notas}</div>}
                <div className="flags">
                  {!ent && [['arteAprobado', 'arte_aprobado', 'Arte aprobado', r.includes('preprensa')], ['materialListo', 'material_listo', 'Material listo', true], ['anticipo', 'anticipo', 'Anticipo', true]].filter((x) => x[3]).map(([k, col, l]) => (
                    <button key={k} className={'flag ' + (o[k] ? 'yes' : 'no')} disabled={!puede || busy} aria-pressed={!!o[k]}
                      onClick={() => run(() => supabase.from('ordenes').update({ [col]: !o[k] }).eq('id', o.id))}>{o[k] ? '✓' : '○'} {l}</button>
                  ))}
                  {puede && (
                    <div className="acts">
                      {cf ? (
                        <>
                          <span className="small muted">{cf === 'entregar' ? '¿Marcar como entregado?' : '¿Eliminar este pedido y sus registros?'}</span>
                          <button className={'btn sm ' + (cf === 'borrar' ? 'danger' : 'primary')} disabled={busy} onClick={async () => {
                            setConfirm(null);
                            if (cf === 'entregar') await run(() => supabase.from('ordenes').update({ estado: 'entregado', entregado: new Date().toISOString() }).eq('id', o.id), 'Pedido marcado como entregado.');
                            else await run(() => supabase.from('ordenes').delete().eq('id', o.id), 'Pedido eliminado.');
                          }}>Sí, {cf === 'entregar' ? 'entregado' : 'eliminar'}</button>
                          <button className="btn sm" onClick={() => setConfirm(null)}>No</button>
                        </>
                      ) : (
                        <>
                          {!ent && <button className="btn sm" onClick={() => { setErr(''); setDraft(structuredClone(o)); window.scrollTo(0, 0); }}>Editar</button>}
                          {!ent && <button className="btn sm" onClick={() => setConfirm({ id: o.id, a: 'entregar' })}>Marcar entregado</button>}
                          {ent && <button className="btn sm" onClick={() => run(() => supabase.from('ordenes').update({ estado: 'activo', entregado: null }).eq('id', o.id), 'Pedido reactivado.')}>Reactivar</button>}
                          {perfil.rol === 'direccion' && <button className="btn sm danger" onClick={() => setConfirm({ id: o.id, a: 'borrar' })}>Eliminar</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="empty">{filtro === 'activos' ? 'No hay pedidos activos. Crea el primero con "Nuevo pedido".' : 'No hay pedidos en esta vista.'}</div>}
    </>
  );
}
