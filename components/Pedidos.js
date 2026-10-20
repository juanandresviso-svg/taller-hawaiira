'use client';
import { useState } from 'react';
import { DECO_NAME, STAGE_NAME, fd, parseDay, nf, pct, ordenADb } from '@/lib/motor';
import { Pill, decoTexto } from './ui';
import NuevoProducto from './NuevoProducto';
import Salida from './Salida';
import Importar from './Importar';
import { subirOC, verOC, OC_TIPOS } from '@/lib/oc';
import { revisarNovedades } from '@/lib/avisos';
import { pasosDe, cotizacionDe } from '@/lib/proceso';
import Seguimiento from './Seguimiento';

const EDITAN = ['direccion', 'jefa', 'admin', 'compras', 'diseno'];

function nuevoCodigo(ordenes) {
  let m = 0;
  ordenes.forEach((o) => { const n = parseInt(String(o.codigo || '').replace(/\D/g, ''), 10); if (n > m) m = n; });
  return 'OP-' + String(m + 1).padStart(4, '0');
}

export default function Pedidos({ supabase, perfil, M, ordenes, perfiles, materiales, consumos, veMateriales, veCostos, cotizaciones, hitos = [], documentos = [], avisar, recargar }) {
  const [filtro, setFiltro] = useState('activos');
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importando, setImportando] = useState(false);
  const [nuevoProd, setNuevoProd] = useState(false);
  const [salida, setSalida] = useState(null);
  const [ocFile, setOcFile] = useState(null);
  const [ocPara, setOcPara] = useState(null); // pedido al que se le está subiendo la OC
  const [ocNum, setOcNum] = useState('');
  const puede = EDITAN.includes(perfil.rol);

  // Seguimiento del flujo de cada pedido (pasos cumplidos, próximo paso y documentos en Drive)
  const hitosDe = {}, docsDe = {};
  hitos.forEach((h) => { if (h.orden_id) (hitosDe[h.orden_id] = hitosDe[h.orden_id] || []).push(h); });
  documentos.forEach((d) => { if (d.orden_id) (docsDe[d.orden_id] = docsDe[d.orden_id] || []).push(d); });
  const SEG = {};
  ordenes.forEach((o) => { SEG[o.id] = pasosDe(o, { M, hitos: hitosDe[o.id] || [], cot: veCostos ? cotizacionDe(o, cotizaciones) : undefined }); });

  let list = ordenes.slice();
  const enEspera = ordenes.filter((o) => o.estado === 'espera');
  const porCobrar = ordenes.filter((o) => o.estado === 'entregado' && !SEG[o.id].cerrado);
  if (filtro === 'activos') list = list.filter((o) => o.estado !== 'entregado');
  else if (filtro === 'espera') list = enEspera.slice();
  else if (filtro === 'cobrar') list = porCobrar.slice();
  else if (filtro === 'entregados') list = list.filter((o) => o.estado === 'entregado');
  const rank = { rojo: 0, amarillo: 1, verde: 2, listo: 3, entregado: 4 };
  const rk = (o) => (o.estado === 'espera' ? -1 : rank[M.status[o.id]?.est] ?? 5);
  list.sort((a, b) => (rk(a) - rk(b)) || (a.fechaCompromiso || '').localeCompare(b.fechaCompromiso || ''));

  async function run(fn, ok) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { avisar('No se pudo guardar: ' + (error.message || 'revisa la conexión.')); return false; }
    if (ok) avisar(ok);
    revisarNovedades();
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
      deco: { tipo: draft.deco.tipo || 'ninguna', colores: Math.max(1, +draft.deco.colores || 1), ubicaciones: Math.max(1, +draft.deco.ubicaciones || 1), ...(draft.deco.tipo === 'bordado' ? { bordadoModo: draft.deco.bordadoModo === 'externo' ? 'externo' : 'interno' } : {}) },
    });
    body.oc_numero = String(draft.ocNumero || '').trim();
    let oc = null;
    if (ocFile) {
      setBusy(true);
      const r = await subirOC(supabase, ocFile, { referencia: draft.codigo, numero: body.oc_numero, perfilId: perfil.id });
      setBusy(false);
      if (r.error) return setErr(r.error);
      oc = r.campos;
      if (draft.id && draft.estado !== 'espera') { delete oc.estado; delete oc.activado; } // reemplaza la OC de un pedido ya activo
    }
    const ok = draft.id
      ? await run(() => supabase.from('ordenes').update({ ...body, ...(oc || {}) }).eq('id', draft.id), oc && draft.estado === 'espera' ? `Pedido ${draft.codigo} activado con la orden de compra.` : 'Pedido actualizado.')
      : await run(() => supabase.from('ordenes').insert({ ...body, ...(oc || { estado: 'espera' }), creado_por: perfil.id }),
        oc ? `Pedido ${draft.codigo} creado y activado con la orden de compra.` : `Pedido ${draft.codigo} creado. Queda por activar hasta que subas la orden de compra del cliente.`);
    if (ok) { setDraft(null); setErr(''); setOcFile(null); }
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {[['activos', 'Activos'], ['espera', `Por activar${enEspera.length ? ' (' + enEspera.length + ')' : ''}`], ['cobrar', `Por cobrar${porCobrar.length ? ' (' + porCobrar.length + ')' : ''}`], ['entregados', 'Entregados'], ['todos', 'Todos']].map(([k, v]) => (
            <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{v}</button>
          ))}
        </div>
        {puede && <div className="acts" style={{ marginLeft: 0 }}><button className="btn" data-tour="importar" onClick={() => { setDraft(null); setImportando(true); window.scrollTo(0, 0); }}>Importar pedidos</button><button className="btn primary" data-tour="nuevo-pedido" onClick={() => { setErr(''); setOcFile(null); setDraft({ ocNumero: '', codigo: nuevoCodigo(ordenes), cliente: '', responsableId: perfil.id, producto: 'franela', cantidad: '', tallas: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 }, fechaCompromiso: '', monto: '', notas: '', arteAprobado: false, materialListo: false, anticipo: false }); window.scrollTo(0, 0); }}>Nuevo pedido</button></div>}
      </div>

      {importando && <Importar supabase={supabase} perfil={perfil} M={M} ordenes={ordenes} perfiles={perfiles} avisar={avisar} onClose={() => setImportando(false)} />}

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
              <select id="f-prod" value={draft.producto} onChange={(e) => { if (e.target.value === '__nuevo') setNuevoProd(true); else set('producto', e.target.value); }}>
                {Object.entries(M.cfg.productos).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                <option value="__nuevo">+ Agregar producto nuevo…</option>
              </select>
            </label>
            <label className="f">Cantidad<input id="f-cant" type="number" min="1" inputMode="numeric" value={draft.cantidad} onChange={(e) => set('cantidad', e.target.value)} /></label>
            <label className="f">Tallas<input id="f-tallas" placeholder="S 50 · M 120 · L 100" value={draft.tallas} onChange={(e) => set('tallas', e.target.value)} /></label>
            <label className="f">Estampado
              <select id="f-deco" value={draft.deco.tipo} onChange={(e) => set('deco.tipo', e.target.value)}>
                {Object.entries(DECO_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {draft.deco.tipo === 'bordado' && (
              <label className="f">¿Quién borda?
                <select id="f-bmodo" value={draft.deco.bordadoModo || 'interno'} onChange={(e) => set('deco.bordadoModo', e.target.value)}>
                  <option value="interno">Interno (máquina del taller)</option>
                  <option value="externo">Externo (taller aliado)</option>
                </select>
              </label>
            )}
            {draft.deco.tipo === 'serigrafia' && <label className="f">Colores (serigrafía)<input id="f-col" type="number" min="1" value={draft.deco.colores} onChange={(e) => set('deco.colores', e.target.value)} /></label>}
            {draft.deco.tipo !== 'ninguna' && <label className="f">Ubicaciones<input id="f-ub" type="number" min="1" value={draft.deco.ubicaciones} onChange={(e) => set('deco.ubicaciones', e.target.value)} /></label>}
            <label className="f">Fecha comprometida<input id="f-fecha" type="date" value={draft.fechaCompromiso || ''} onChange={(e) => set('fechaCompromiso', e.target.value)} /></label>
            <label className="f">Monto (US$)<input id="f-monto" type="number" min="0" value={draft.monto} onChange={(e) => set('monto', e.target.value)} /></label>
          </div>
          {nuevoProd && (
            <div style={{ marginTop: 12 }}>
              <NuevoProducto supabase={supabase} cfg={M.cfg} onCancel={() => setNuevoProd(false)}
                onCreado={async (clave, nombre) => { await recargar.config(); set('producto', clave); setNuevoProd(false); avisar(`Producto "${nombre}" creado.`); }} />
            </div>
          )}
          {(!draft.id || draft.estado === 'espera' || !draft.ocArchivo) && (
            <div className="subcard" style={{ marginTop: 12 }} data-tour="oc">
              <b className="small">Orden de compra del cliente</b>
              <div className="fgrid" style={{ marginTop: 8 }}>
                <label className="f">N.º de OC<input id="f-ocnum" placeholder="Ej. 4500123" value={draft.ocNumero || ''} onChange={(e) => set('ocNumero', e.target.value)} /></label>
                <label className="f">Archivo (PDF o foto)<input id="f-ocfile" type="file" accept={OC_TIPOS} onChange={(e) => setOcFile(e.target.files[0] || null)} /></label>
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>{ocFile ? 'El pedido se activa y entra en el plan del taller al guardar.' : draft.estado === 'activo' ? 'Opcional: adjunta la OC de este pedido.' : 'Sin la OC el pedido queda "por activar": se guarda, pero no entra en el plan del taller hasta que la subas.'}</p>
            </div>
          )}
          <label className="f" style={{ marginTop: 12 }}>Notas<textarea id="f-notas" rows={2} value={draft.notas} onChange={(e) => set('notas', e.target.value)} /></label>
          <div className="checks">
            <label><input type="checkbox" checked={!!draft.arteAprobado} onChange={(e) => set('arteAprobado', e.target.checked)} />Arte aprobado</label>
            <label><input type="checkbox" checked={!!draft.materialListo} onChange={(e) => set('materialListo', e.target.checked)} />Material listo</label>
            <label><input type="checkbox" checked={!!draft.anticipo} onChange={(e) => set('anticipo', e.target.checked)} />Anticipo recibido</label>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="formacts">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : draft.id ? 'Guardar cambios' : ocFile ? 'Crear y activar pedido' : 'Crear pedido (por activar)'}</button>
            <button className="btn" type="button" onClick={() => { setDraft(null); setOcFile(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {list.length ? (
        <div className="list">
          {list.map((o, idx) => {
            const s = M.status[o.id] || {}, r = M.ruta(o), cs = M.curStage(o), d = o.deco || {}, ent = o.estado === 'entregado', esp = o.estado === 'espera';
            const deco = decoTexto(d);
            const cf = confirm && confirm.id === o.id ? confirm.a : null;
            const dueno = M.nombreDe(o.responsableId);
            return (
              <article key={o.id} className="op" data-tour={idx === 0 ? 'pedido' : undefined}>
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
                {(esp || o.ocArchivo) && (
                  <div className="oc">
                    {o.ocArchivo
                      ? <><span>Orden de compra{o.ocNumero ? <> <b>{o.ocNumero}</b></> : null} · subida {fd(new Date(o.ocSubida))}</span><button className="btn sm" onClick={async () => { const e = await verOC(supabase, o.ocArchivo); if (e) avisar('No se pudo abrir la OC: ' + e); }}>Ver OC</button></>
                      : <span className="falta">Falta la orden de compra del cliente: no entra en el plan del taller.</span>}
                    {esp && puede && ocPara !== o.id && <button className="btn sm primary" onClick={() => { setOcPara(o.id); setOcNum(o.ocNumero || ''); }}>Subir OC y activar</button>}
                  </div>
                )}
                {ocPara === o.id && (
                  <form className="subcard" onSubmit={async (e) => {
                    e.preventDefault();
                    const f = e.currentTarget.elements.ocfile.files[0];
                    setBusy(true);
                    const r2 = await subirOC(supabase, f, { referencia: o.codigo, numero: ocNum, perfilId: perfil.id });
                    setBusy(false);
                    if (r2.error) return avisar(r2.error);
                    if (await run(() => supabase.from('ordenes').update(r2.campos).eq('id', o.id), `${o.codigo} activado: ya entra en el plan del taller.`)) setOcPara(null);
                  }}>
                    <div className="fgrid">
                      <label className="f">N.º de OC<input value={ocNum} onChange={(e) => setOcNum(e.target.value)} placeholder="Ej. 4500123" /></label>
                      <label className="f">Archivo (PDF o foto)<input name="ocfile" type="file" accept={OC_TIPOS} required /></label>
                    </div>
                    <div className="formacts"><button className="btn sm primary" disabled={busy} type="submit">{busy ? 'Subiendo…' : 'Subir y activar'}</button><button className="btn sm" type="button" onClick={() => setOcPara(null)}>Cancelar</button></div>
                  </form>
                )}
                <div className="flags">
                  {!ent && [['arteAprobado', 'arte_aprobado', 'Arte aprobado', r.includes('preprensa')], ['materialListo', 'material_listo', 'Material listo', true], ['anticipo', 'anticipo', 'Anticipo', true]].filter((x) => x[3]).map(([k, col, l]) => (
                    <button key={k} className={'flag ' + (o[k] ? 'yes' : 'no')} disabled={!puede || busy} aria-pressed={!!o[k]}
                      onClick={() => run(() => supabase.from('ordenes').update({ [col]: !o[k] }).eq('id', o.id))}>{o[k] ? '✓' : '○'} {l}</button>
                  ))}
                  {puede && (
                    <div className="acts">
                      {cf ? (
                        <>
                          <span className="small muted">{cf === 'entregar' ? '¿Marcar como entregado?' : cf === 'activar' ? '¿Activar sin orden de compra?' : '¿Eliminar este pedido y sus registros?'}</span>
                          <button className={'btn sm ' + (cf === 'borrar' ? 'danger' : 'primary')} disabled={busy} onClick={async () => {
                            setConfirm(null);
                            if (cf === 'entregar') await run(() => supabase.from('ordenes').update({ estado: 'entregado', entregado: new Date().toISOString() }).eq('id', o.id), 'Pedido entregado: sus tiempos reales ya cuentan en los tiempos de producción. El informe está en el botón Informe.');
                            else if (cf === 'activar') await run(() => supabase.from('ordenes').update({ estado: 'activo', activado: new Date().toISOString() }).eq('id', o.id), `${o.codigo} activado sin orden de compra.`);
                            else await run(() => supabase.from('ordenes').delete().eq('id', o.id), 'Pedido eliminado.');
                          }}>Sí, {cf === 'entregar' ? 'entregado' : cf === 'activar' ? 'activar' : 'eliminar'}</button>
                          <button className="btn sm" onClick={() => setConfirm(null)}>No</button>
                        </>
                      ) : (
                        <>
                          {!ent && <button className="btn sm" onClick={() => { setErr(''); setOcFile(null); setDraft(structuredClone(o)); window.scrollTo(0, 0); }}>Editar</button>}
                          {!ent && !esp && <button className="btn sm" onClick={() => setConfirm({ id: o.id, a: 'entregar' })}>Marcar entregado</button>}
                          {esp && perfil.rol === 'direccion' && <button className="btn sm" onClick={() => setConfirm({ id: o.id, a: 'activar' })}>Activar sin OC</button>}
                          {ent && <button className="btn sm" onClick={() => run(() => supabase.from('ordenes').update({ estado: 'activo', entregado: null }).eq('id', o.id), 'Pedido reactivado.')}>Reactivar</button>}
                          {!esp && <a className="btn sm" href={'/informe/' + o.id} target="_blank" rel="noreferrer">Informe</a>}
                          {veMateriales && !ent && <button className="btn sm" onClick={() => setSalida(salida === o.id ? null : o.id)}>Salida de material</button>}
                          {perfil.rol === 'direccion' && <button className="btn sm danger" onClick={() => setConfirm({ id: o.id, a: 'borrar' })}>Eliminar</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Seguimiento o={o} S={SEG[o.id]} supabase={supabase} perfil={perfil} docs={docsDe[o.id] || []} nombreDe={(id) => (perfiles.find((p) => p.id === id) || {}).nombre || ''} avisar={avisar} busy={busy} setBusy={setBusy} tour={idx === 0} />
                {salida === o.id && <Salida supabase={supabase} orden={o} materiales={materiales} consumos={consumos} avisar={avisar} onClose={() => setSalida(null)} puedeBorrar={['direccion', 'jefa', 'admin'].includes(perfil.rol)} />}
              </article>
            );
          })}
        </div>
      ) : <div className="empty">{filtro === 'activos' ? 'No hay pedidos activos. Crea el primero con "Nuevo pedido".' : filtro === 'espera' ? 'No hay pedidos esperando orden de compra.' : filtro === 'cobrar' ? 'No hay pedidos entregados pendientes de cobro.' : 'No hay pedidos en esta vista.'}</div>}
    </>
  );
}
