'use client';
import { useState } from 'react';
import { DECO_NAME, STAGE_NAME, fd, parseDay, nf, pct, ordenADb } from '@/lib/motor';
import { Pill, decoTexto } from './ui';
import NuevoProducto from './NuevoProducto';
import Salida from './Salida';
import Importar from './Importar';
import { verOC } from '@/lib/oc';
import { usd } from '@/lib/costos';
import OCLector from './OCLector';
import EnviarOP from './EnviarOP';
import { codigoProducto, numeroSiguiente, OBSERVACIONES_BASE, PAGO_BASE } from '@/lib/formatoCotizacion';
import { isoDay } from '@/lib/motor';
import { revisarNovedades } from '@/lib/avisos';
import { pasosDe, cotizacionDe } from '@/lib/proceso';
import Seguimiento from './Seguimiento';

const EDITAN = ['direccion', 'jefa', 'admin', 'compras', 'diseno'];

function nuevoCodigo(ordenes) {
  let m = 0;
  ordenes.forEach((o) => { const n = parseInt(String(o.codigo || '').replace(/\D/g, ''), 10); if (n > m) m = n; });
  return 'OP-' + String(m + 1).padStart(4, '0');
}

export default function Pedidos({ supabase, perfil, M, K, ordenes, perfiles, materiales, consumos, veMateriales, veCostos, cotizaciones = [], hitos = [], documentos = [], clientes = [], registros = [], config, avisar, recargar }) {
  const [filtro, setFiltro] = useState('activos');
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importando, setImportando] = useState(false);
  const [nuevoProd, setNuevoProd] = useState(false);
  const [salida, setSalida] = useState(null);
  const [desdeOC, setDesdeOC] = useState(false);   // nuevo pedido a partir de la orden de compra
  const [ocPre, setOcPre] = useState(null);         // OC ya leída para el pedido nuevo
  const [enviando, setEnviando] = useState(null);   // { id, reenviar }: panel de enviar la orden de producción
  const ctxEquipo = { M, perfiles, registros, config };
  const puede = EDITAN.includes(perfil.rol);
  const cotDe = (o) => (o.cotizacionId ? cotizaciones.find((c) => c.id === o.cotizacionId) || null : null);

  // Paso 1 del pedido: generar su cotización (con el formato de Hawaiira Studio) a partir de los datos del pedido
  async function generarCotizacion(o) {
    if (!K) return avisar('Solo Dirección, jefe de taller y Administración pueden generar cotizaciones.');
    const ventana = window.open('', '_blank');
    const E = K.C.empresa || {};
    const pres = K.presupuesto(o);
    const precio = o.monto && o.cantidad ? Math.round((o.monto / o.cantidad) * 100) / 100 : Math.ceil(K.precioSugerido(pres.unitario) * 20) / 20;
    const item = { producto: o.producto, codigo: codigoProducto(o.producto, M.cfg.productos), nombre: M.prod(o).nombre, descripcion: [M.prod(o).nombre, decoTexto(o.deco)].join(' ').trim(), cantidad: o.cantidad, tallas: o.tallas || '', deco: o.deco, precio, costo: Math.round(pres.unitario * 100) / 100, manual: true };
    const v = new Date(M.t0); v.setDate(v.getDate() + (+K.C.validezDias || 15));
    setBusy(true);
    const { data, error } = await supabase.from('cotizaciones').insert({
      numero: numeroSiguiente(cotizaciones.map((c) => c.numero), E.proximaCotizacion), cliente: o.cliente, contacto: '', items: [item],
      notas: E.observaciones || OBSERVACIONES_BASE, metodo_pago: E.metodoPago || PAGO_BASE, fecha_entrega: o.fechaCompromiso || null,
      validez: isoDay(v), total: Math.round(o.cantidad * precio * 100) / 100, estado: 'enviada', ordenes: [o.codigo],
    }).select('id, numero').single();
    if (!error) await supabase.from('ordenes').update({ cotizacion_id: data.id, ...(o.monto ? {} : { monto: Math.round(o.cantidad * precio * 100) / 100 }) }).eq('id', o.id);
    setBusy(false);
    if (error) { if (ventana) ventana.close(); return avisar('No se pudo generar la cotización: ' + error.message); }
    if (ventana) ventana.location.href = '/cotizacion/' + data.id;
    avisar(`Cotización ${data.numero} generada para ${o.codigo}. Edítala en Costos → Cotizaciones si hace falta; cuando el cliente la acepte, envía la orden de producción.`);
    recargar.cotizaciones && recargar.cotizaciones(); recargar.ordenes(); revisarNovedades();
  }

  // Seguimiento del flujo de cada pedido (pasos cumplidos, próximo paso y documentos en Drive)
  const hitosDe = {}, hitosCotDe = {}, docsDe = {};
  hitos.forEach((h) => { if (h.orden_id) (hitosDe[h.orden_id] = hitosDe[h.orden_id] || []).push(h); if (h.cotizacion_id) (hitosCotDe[h.cotizacion_id] = hitosCotDe[h.cotizacion_id] || []).push(h); });
  documentos.forEach((d) => { if (d.orden_id) (docsDe[d.orden_id] = docsDe[d.orden_id] || []).push(d); });
  const SEG = {};
  ordenes.forEach((o) => { SEG[o.id] = pasosDe(o, { M, hitos: hitosDe[o.id] || [], hitosCot: hitosCotDe[o.cotizacionId] || [], cot: veCostos ? cotizacionDe(o, cotizaciones) : undefined }); });

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
    if (!draft.id && ocPre) Object.assign(body, ocPre);
    const ok = draft.id
      ? await run(() => supabase.from('ordenes').update(body).eq('id', draft.id), 'Pedido actualizado.')
      : await run(() => supabase.from('ordenes').insert({ ...body, estado: 'espera', creado_por: perfil.id }),
        `Pedido ${draft.codigo} creado. Para que entre en el plan del taller, pulsa "Enviar orden de producción".`);
    if (ok) { setDraft(null); setErr(''); setOcPre(null); }
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          {[['activos', 'Activos'], ['espera', `Por enviar OP${enEspera.length ? ' (' + enEspera.length + ')' : ''}`], ['cobrar', `Por cobrar${porCobrar.length ? ' (' + porCobrar.length + ')' : ''}`], ['entregados', 'Entregados'], ['todos', 'Todos']].map(([k, v]) => (
            <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{v}</button>
          ))}
        </div>
        {puede && <div className="acts" style={{ marginLeft: 0 }}><button className="btn" data-tour="importar" onClick={() => { setDraft(null); setImportando(true); window.scrollTo(0, 0); }}>Importar pedidos</button><button className="btn" data-tour="desde-oc" onClick={() => { setErr(''); setDraft(null); setOcPre(null); setDesdeOC(true); window.scrollTo(0, 0); }}>Nuevo pedido desde OC</button><button className="btn primary" data-tour="nuevo-pedido" onClick={() => { setErr(''); setOcPre(null); setDesdeOC(false); setDraft({ codigo: nuevoCodigo(ordenes), cliente: '', responsableId: perfil.id, producto: 'franela', cantidad: '', tallas: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 }, fechaCompromiso: '', monto: '', notas: '', arteAprobado: false, materialListo: false, anticipo: false }); window.scrollTo(0, 0); }}>Nuevo pedido</button></div>}
      </div>

      {importando && <Importar supabase={supabase} perfil={perfil} M={M} ordenes={ordenes} perfiles={perfiles} avisar={avisar} onClose={() => setImportando(false)} />}

      {desdeOC && !draft && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Nuevo pedido desde la orden de compra</h3>
          <OCLector supabase={supabase} perfil={perfil} referencia={nuevoCodigo(ordenes)} textoListo="Crear el pedido con estos datos"
            onCancel={() => setDesdeOC(false)}
            onListo={(r) => {
              const a = r.aplicar, items = (r.datos.items || []).map((i) => [i.descripcion, i.cantidad != null ? '× ' + i.cantidad : ''].filter(Boolean).join(' ')).join(' · ');
              setOcPre(r.campos); setDesdeOC(false);
              setDraft({ ...{ codigo: nuevoCodigo(ordenes), cliente: '', responsableId: perfil.id, producto: 'franela', cantidad: '', tallas: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 }, fechaCompromiso: '', monto: '', notas: '', arteAprobado: false, materialListo: false, anticipo: false }, cliente: a.cliente || '', cantidad: a.cantidad || '', monto: a.monto || '', fechaCompromiso: a.fechaCompromiso || '', tallas: a.tallas || '', notas: [r.campos.oc_numero ? 'OC ' + r.campos.oc_numero : '', items].filter(Boolean).join(' · ') });
            }} />
        </div>
      )}

      {draft && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={guardar} noValidate>
          <h3 style={{ marginBottom: 12 }}>{draft.id ? 'Editar ' + draft.codigo : 'Nuevo pedido · ' + draft.codigo}</h3>
          <div className="fgrid">
            <label className="f">Cliente<input id="f-cliente" list="lista-clientes" value={draft.cliente} onChange={(e) => set('cliente', e.target.value)} autoComplete="off" /></label>
            <datalist id="lista-clientes">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
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
          {ocPre && (
            <div className="subcard small" style={{ marginTop: 12 }}>
              Orden de compra adjunta{ocPre.oc_numero ? <> <b>{ocPre.oc_numero}</b></> : null}{ocPre.oc_unidades != null ? ` · ${nf.format(ocPre.oc_unidades)} unidades` : ''}{ocPre.oc_monto != null ? ` · ${usd.format(ocPre.oc_monto)}` : ''}. Revisa producto, estampado y fecha, y guarda. Luego envía la orden de producción.
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
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Crear pedido'}</button>
            <button className="btn" type="button" onClick={() => { setDraft(null); setOcPre(null); }}>Cancelar</button>
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
                {(o.ocArchivo || o.ocNumero) && (
                  <div className="oc">
                    <span>Orden de compra{o.ocNumero ? <> <b>{o.ocNumero}</b></> : null}{o.ocUnidades != null ? <> · <b>{nf.format(o.ocUnidades)}</b> unidades</> : null}{o.ocMonto != null ? <> · <b>{usd.format(o.ocMonto)}</b></> : null}{o.ocUnidades != null && o.ocUnidades !== o.cantidad ? <span className="falta"> · el pedido tiene {nf.format(o.cantidad)}</span> : null}</span>
                    {o.ocArchivo && <button className="btn sm" onClick={async () => { const e = await verOC(supabase, o.ocArchivo); if (e) avisar('No se pudo abrir la OC: ' + e); }}>Ver OC</button>}
                  </div>
                )}
                {o.cotizacionId && (() => { const c = cotDe(o); return <div className="oc"><span>Cotización{c ? <> <b>{c.numero}</b> · {c.estado}</> : ' generada'}</span>{c && <a className="btn sm" href={'/cotizacion/' + c.id} target="_blank" rel="noreferrer">Ver cotización</a>}</div>; })()}
                {esp && !(enviando && enviando.id === o.id) && (
                  !o.cotizacionId
                    ? <div className="oc"><span className="falta">Paso 1: generar la cotización. Paso 2: enviar la orden de producción.</span>{veCostos ? <button className="btn sm primary" disabled={busy} onClick={() => generarCotizacion(o)}>Generar cotización</button> : <span className="small muted">Pídela a Administración o Dirección.</span>}{perfil.rol === 'direccion' && <button className="btn sm" onClick={() => setEnviando({ id: o.id, reenviar: false })}>Enviar OP sin cotización</button>}</div>
                    : <div className="oc"><span className="falta">Falta enviar la orden de producción: el pedido no entra en el plan del taller.</span>{puede && <button className="btn sm primary" onClick={() => setEnviando({ id: o.id, reenviar: false })}>Enviar orden de producción</button>}</div>
                )}
                {enviando && enviando.id === o.id && <EnviarOP o={o} cot={cotDe(o)} supabase={supabase} perfil={perfil} M={M} perfiles={perfiles} registros={registros} config={config} avisar={avisar} recargar={recargar} reenviar={enviando.reenviar} onClose={() => setEnviando(null)} />}
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
                            if (cf === 'entregar') await run(() => supabase.from('ordenes').update({ estado: 'entregado', entregado: new Date().toISOString() }).eq('id', o.id), 'Pedido entregado: sus tiempos reales ya cuentan en los tiempos de producción. El informe está en el botón Informe.');
                            else await run(() => supabase.from('ordenes').delete().eq('id', o.id), 'Pedido eliminado.');
                          }}>Sí, {cf === 'entregar' ? 'entregado' : 'eliminar'}</button>
                          <button className="btn sm" onClick={() => setConfirm(null)}>No</button>
                        </>
                      ) : (
                        <>
                          {!ent && <button className="btn sm" onClick={() => { setErr(''); setOcFile(null); setDraft(structuredClone(o)); window.scrollTo(0, 0); }}>Editar</button>}
                          {!ent && !esp && <button className="btn sm" onClick={() => setConfirm({ id: o.id, a: 'entregar' })}>Marcar entregado</button>}
                          {ent && <button className="btn sm" onClick={() => run(() => supabase.from('ordenes').update({ estado: 'activo', entregado: null }).eq('id', o.id), 'Pedido reactivado.')}>Reactivar</button>}
                          {!esp && <a className="btn sm" href={'/informe/' + o.id} target="_blank" rel="noreferrer">Informe</a>}
                          {veMateriales && !ent && <button className="btn sm" onClick={() => setSalida(salida === o.id ? null : o.id)}>Materiales</button>}
                          {perfil.rol === 'direccion' && <button className="btn sm danger" onClick={() => setConfirm({ id: o.id, a: 'borrar' })}>Eliminar</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Seguimiento o={o} S={SEG[o.id]} supabase={supabase} perfil={perfil} docs={docsDe[o.id] || []} nombreDe={(id) => (perfiles.find((p) => p.id === id) || {}).nombre || ''} avisar={avisar} busy={busy} setBusy={setBusy} tour={idx === 0} ctx={ctxEquipo} onEnviarOP={puede && (o.cotizacionId || perfil.rol === 'direccion' || o.estado !== 'espera') ? (reenviar) => setEnviando({ id: o.id, reenviar }) : null} />
                {salida === o.id && <Salida supabase={supabase} orden={o} materiales={materiales} consumos={consumos} avisar={avisar} onClose={() => setSalida(null)} recargar={recargar} puedeBorrar={['direccion', 'jefa', 'admin'].includes(perfil.rol)} />}
              </article>
            );
          })}
        </div>
      ) : <div className="empty">{filtro === 'activos' ? 'No hay pedidos activos. Crea el primero con "Nuevo pedido".' : filtro === 'espera' ? 'No hay pedidos esperando la orden de producción.' : filtro === 'cobrar' ? 'No hay pedidos entregados pendientes de cobro.' : 'No hay pedidos en esta vista.'}</div>}
    </>
  );
}
