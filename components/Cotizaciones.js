'use client';
import { useState } from 'react';
import { usd, usd0 } from '@/lib/costos';
import { DECO_NAME, fd, parseDay, isoDay, nf, pct, ordenADb } from '@/lib/motor';
import { decoTexto } from './ui';
import NuevoProducto from './NuevoProducto';
import OCLector from './OCLector';
import { evaluarPasos, claveHitoCot, puedeMarcar, TOTAL_PASOS } from '@/lib/proceso';
import { revisarNovedades } from '@/lib/avisos';

const ESTADO = { borrador: ['gris', 'Borrador'], enviada: ['listo', 'Enviada'], aprobada: ['verde', 'Aprobada'], rechazada: ['rojo', 'Rechazada'] };
const redondear = (v) => Math.ceil(v * 20) / 20; // a 0,05 US$

function siguiente(lista, prefijo) {
  let m = 0;
  lista.forEach((c) => { const n = parseInt(String(c || '').replace(/\D/g, ''), 10); if (n > m) m = n; });
  return prefijo + String(m + 1).padStart(4, '0');
}
const itemVacio = (prod) => ({ producto: prod, descripcion: '', cantidad: '', tallas: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 }, precio: '', manual: false });

// Pasos 1 a 8 del flujograma (cotización)
function PasosCot({ c, M, hitos, perfil, supabase, avisar, recargar }) {
  const S = evaluarPasos({ cot: c, M, hitos: hitos.filter((h) => h.cotizacion_id === c.id) });
  const marcar = async (p) => {
    const { error } = await supabase.from('hitos').insert({ clave: claveHitoCot(c.id, p.k), cotizacion_id: c.id, paso: p.k, nota: '', auto: false, por: perfil.id });
    if (error) avisar('No se pudo guardar: ' + error.message); else { avisar(`${c.numero}: paso ${p.n} registrado.`); recargar.hitos && recargar.hitos(); revisarNovedades(); }
  };
  return (
    <div className="pasos-cot">
      {S.lista.filter((p) => !p.na).map((p) => (
        <span key={p.k} className={'pc ' + (p.hecho ? 'hecho' : p.omitido ? 'omitido' : '')} title={p.nombre + ' · ' + p.cargo}>
          <i>{p.hecho ? '✓' : p.n}</i>{p.nombre}
          {!p.hecho && !p.omitido && p.modo === 'manual' && puedeMarcar(p, perfil) && <button className="btn sm link" onClick={() => marcar(p)}>{p.k === 'p05' ? 'Aprobar' : 'Marcar'}</button>}
        </span>
      ))}
      <span className="small muted">Pasos 1 a 8 de {TOTAL_PASOS} del flujograma</span>
    </div>
  );
}

export default function Cotizaciones({ supabase, perfil, M, K, ordenes, cotizaciones, documentos = [], hitos = [], clientes = [], avisar, recargar }) {
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [aprobar, setAprobar] = useState(null);
  const [fechaAprob, setFechaAprob] = useState('');
  const [ocAprob, setOcAprob] = useState(null);   // OC leída al aprobar (opcional)
  const [leerOC, setLeerOC] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [nuevoProd, setNuevoProd] = useState(null);
  const primerProd = Object.keys(M.cfg.productos)[0];

  const calc = (it) => {
    const q = Math.max(0, Math.round(+it.cantidad || 0));
    const p = K.presupuesto({ producto: it.producto, cantidad: q || 1, deco: it.deco });
    const sug = redondear(K.precioSugerido(p.unitario));
    const precio = it.manual ? +it.precio || 0 : sug;
    return { q, p, sug, precio, total: q * precio, margen: precio > 0 ? (precio - p.unitario) / precio : null };
  };
  const set = (fn) => setDraft((d) => { const n = structuredClone(d); fn(n); return n; });

  function nueva() {
    setErr('');
    setDraft({ numero: siguiente(cotizaciones.map((c) => c.numero), 'COT-'), cliente: '', contacto: '', fecha_entrega: '', notas: `Precios en US$, no incluyen IVA. Anticipo de ${K.C.anticipo}% para iniciar la producción y el saldo contra entrega.`, items: [itemVacio(primerProd)] });
    window.scrollTo(0, 0);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!draft.cliente.trim()) return setErr('Escribe el cliente.');
    const items = draft.items.map((it) => { const c = calc(it); return { producto: it.producto, nombre: M.cfg.productos[it.producto]?.nombre || it.producto, descripcion: it.descripcion.trim(), cantidad: c.q, tallas: it.tallas.trim(), deco: it.deco, precio: c.precio, costo: Math.round(c.p.unitario * 100) / 100, manual: !!it.manual }; });
    if (!items.length || items.some((i) => !(i.cantidad > 0))) return setErr('Cada línea necesita una cantidad mayor que cero.');
    if (items.some((i) => !(i.precio > 0))) return setErr('Cada línea necesita un precio. Si el costo sale en 0, completa recetas y precios o escribe el precio a mano.');
    const v = new Date(M.t0); v.setDate(v.getDate() + (+K.C.validezDias || 15));
    const body = { numero: draft.numero, cliente: draft.cliente.trim(), contacto: draft.contacto.trim(), items, notas: draft.notas, fecha_entrega: draft.fecha_entrega || null, validez: isoDay(v), total: items.reduce((a, i) => a + i.cantidad * i.precio, 0) };
    setBusy(true);
    const { error } = draft.id ? await supabase.from('cotizaciones').update(body).eq('id', draft.id) : await supabase.from('cotizaciones').insert(body);
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + error.message);
    avisar(draft.id ? 'Cotización actualizada.' : `Cotización ${body.numero} creada.`);
    setDraft(null); recargar.cotizaciones();
  }

  async function estado(c, est) {
    const { error } = await supabase.from('cotizaciones').update({ estado: est }).eq('id', c.id);
    if (error) avisar('No se pudo guardar: ' + error.message); else { recargar.cotizaciones(); revisarNovedades(); }
  }

  async function convertir(c) {
    if (!fechaAprob) return avisar('Indica la fecha de entrega comprometida.');
    setBusy(true);
    const unaLinea = (c.items || []).length === 1;
    const oc = ocAprob ? { ...ocAprob.campos, ...(unaLinea ? {} : { oc_monto: null, oc_unidades: null }) } : {};
    let n = parseInt(siguiente(ordenes.map((o) => o.codigo), '').replace(/\D/g, ''), 10) - 1;
    const filas = c.items.map((it) => ({
      ...ordenADb({ codigo: 'OP-' + String(++n).padStart(4, '0'), cliente: c.cliente, responsableId: perfil.id, producto: it.producto, cantidad: unaLinea && ocAprob && ocAprob.aplicar.cantidad ? ocAprob.aplicar.cantidad : it.cantidad, tallas: (unaLinea && ocAprob && ocAprob.aplicar.tallas) || it.tallas, deco: it.deco, fechaCompromiso: fechaAprob, monto: Math.round(it.cantidad * it.precio * 100) / 100, notas: [`Cotización ${c.numero}`, it.descripcion].filter(Boolean).join(' · '), arteAprobado: false, materialListo: false, anticipo: false }),
      creado_por: perfil.id, cotizacion_id: c.id, estado: 'espera', ...oc,
    }));
    const { data, error } = await supabase.from('ordenes').insert(filas).select('codigo');
    if (error) { setBusy(false); return avisar('No se pudieron crear los pedidos: ' + error.message); }
    await supabase.from('cotizaciones').update({ estado: 'aprobada', fecha_entrega: fechaAprob, ordenes: (data || []).map((x) => x.codigo) }).eq('id', c.id);
    setBusy(false); setAprobar(null); setFechaAprob(''); setOcAprob(null); setLeerOC(false);
    avisar(`Cotización aprobada: se crearon ${filas.length} pedido${filas.length > 1 ? 's' : ''}. Envía la orden de producción desde Pedidos → "Por enviar OP".`);
    recargar.cotizaciones(); recargar.ordenes(); revisarNovedades();
  }

  const aprobadas = cotizaciones.filter((c) => c.estado === 'aprobada'), cerradas = cotizaciones.filter((c) => ['aprobada', 'rechazada'].includes(c.estado));

  return (
    <>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><span className="k">Cotizaciones abiertas</span><span className="v">{cotizaciones.filter((c) => ['borrador', 'enviada'].includes(c.estado)).length}</span></div>
        <div className="kpi"><span className="k">Monto en negociación</span><span className="v">{usd0.format(cotizaciones.filter((c) => c.estado === 'enviada').reduce((a, c) => a + (+c.total || 0), 0))}</span></div>
        <div className="kpi"><span className="k">Tasa de aprobación</span><span className="v">{cerradas.length ? pct(aprobadas.length / cerradas.length) : '—'}</span></div>
      </div>
      <div className="toolbar"><span /><button className="btn primary" onClick={nueva}>Nueva cotización</button></div>

      {draft && (
        <form className="card" onSubmit={guardar} noValidate style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>{draft.id ? 'Editar ' : 'Nueva cotización · '}{draft.numero}</h3>
          <div className="fgrid">
            <label className="f">Cliente<input id="cot-cli" list="lista-clientes-cot" autoComplete="off" value={draft.cliente} onChange={(e) => { const v = e.target.value; const cl = clientes.find((x) => x.nombre === v); set((d) => { d.cliente = v; if (cl && !d.contacto) d.contacto = [cl.contacto, cl.telefono, cl.correo].filter(Boolean).join(' · '); }); }} /></label>
            <datalist id="lista-clientes-cot">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            <label className="f">Contacto (persona, teléfono o correo)<input id="cot-con" value={draft.contacto} onChange={(e) => set((d) => { d.contacto = e.target.value; })} /></label>
            <label className="f">Fecha de entrega propuesta (opcional)<input id="cot-fe" type="date" value={draft.fecha_entrega || ''} onChange={(e) => set((d) => { d.fecha_entrega = e.target.value; })} /></label>
          </div>
          <h2 style={{ marginTop: 18 }}>Productos</h2>
          <div className="list">
            {draft.items.map((it, i) => {
              const c = calc(it);
              return (
                <div key={i} className="subcard">
                  <div className="fgrid">
                    <label className="f">Producto
                      <select value={it.producto} onChange={(e) => { if (e.target.value === '__nuevo') setNuevoProd(i); else set((d) => { d.items[i].producto = e.target.value; }); }}>
                        {Object.entries(M.cfg.productos).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                        <option value="__nuevo">+ Agregar producto nuevo…</option>
                      </select>
                    </label>
                    <label className="f">Cantidad<input type="number" min="1" value={it.cantidad} onChange={(e) => set((d) => { d.items[i].cantidad = e.target.value; })} /></label>
                    <label className="f">Estampado
                      <select value={it.deco.tipo} onChange={(e) => set((d) => { d.items[i].deco.tipo = e.target.value; })}>
                        {Object.entries(DECO_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    {it.deco.tipo === 'bordado' && (
                      <label className="f">¿Quién borda?
                        <select value={it.deco.bordadoModo || 'interno'} onChange={(e) => set((d) => { d.items[i].deco.bordadoModo = e.target.value; })}>
                          <option value="interno">Interno</option><option value="externo">Externo (aliado)</option>
                        </select>
                      </label>
                    )}
                    {it.deco.tipo === 'serigrafia' && <label className="f">Colores<input type="number" min="1" value={it.deco.colores} onChange={(e) => set((d) => { d.items[i].deco.colores = e.target.value; })} /></label>}
                    {it.deco.tipo !== 'ninguna' && <label className="f">Ubicaciones<input type="number" min="1" value={it.deco.ubicaciones} onChange={(e) => set((d) => { d.items[i].deco.ubicaciones = e.target.value; })} /></label>}
                    <label className="f">Descripción para el cliente<input value={it.descripcion} placeholder="Ej. Franela algodón negra, logo frente" onChange={(e) => set((d) => { d.items[i].descripcion = e.target.value; })} /></label>
                    <label className="f">Tallas<input value={it.tallas} placeholder="S 50 · M 120 · L 100" onChange={(e) => set((d) => { d.items[i].tallas = e.target.value; })} /></label>
                    <label className="f">Precio unitario (US$)
                      <input type="number" step="0.05" min="0" value={it.manual ? it.precio : c.sug || ''} onChange={(e) => set((d) => { d.items[i].precio = e.target.value; d.items[i].manual = true; })} />
                    </label>
                  </div>
                  {nuevoProd === i && <div style={{ marginTop: 10 }}><NuevoProducto supabase={supabase} cfg={M.cfg} onCancel={() => setNuevoProd(null)} onCreado={async (clave, nombre) => { await recargar.config(); set((d) => { d.items[i].producto = clave; }); setNuevoProd(null); avisar(`Producto "${nombre}" creado. Agrega su receta en Costos → Recetas.`); }} /></div>}
                  <p className="small" style={{ margin: '8px 0 0' }}>
                    Costo interno: <b>{usd.format(c.p.unitario)}</b>/pieza · Sugerido ({K.C.margen}% margen): <b>{usd.format(c.sug)}</b>
                    {' · '}Margen con este precio: <b className={c.margen != null && c.margen < 0.15 ? 'neg' : 'pos'}>{c.margen == null ? '—' : pct(c.margen)}</b>
                    {' · '}Subtotal: <b>{usd.format(c.total)}</b>
                    {it.manual && <> · <button type="button" className="btn link" onClick={() => set((d) => { d.items[i].manual = false; d.items[i].precio = ''; })}>usar sugerido</button></>}
                  </p>
                  {c.p.faltantes.length > 0 && <p className="small" style={{ color: 'var(--warn)', margin: '4px 0 0' }}>Costo incompleto: falta {c.p.faltantes.join(', ')}.</p>}
                  {draft.items.length > 1 && <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => set((d) => { d.items.splice(i, 1); })}>Quitar producto</button>}
                </div>
              );
            })}
          </div>
          <div className="formacts"><button type="button" className="btn sm" onClick={() => set((d) => { d.items.push(itemVacio(primerProd)); })}>Agregar otro producto</button></div>
          <label className="f" style={{ marginTop: 12 }}>Condiciones y notas (aparecen en la cotización)<textarea id="cot-notas" rows={3} value={draft.notas} onChange={(e) => set((d) => { d.notas = e.target.value; })} /></label>
          <p style={{ margin: '12px 0 0' }}>Total: <b>{usd.format(draft.items.reduce((a, it) => a + calc(it).total, 0))}</b></p>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="formacts">
            <button className="btn primary" type="submit" disabled={busy}>{draft.id ? 'Guardar cambios' : 'Guardar cotización'}</button>
            <button className="btn" type="button" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cotizaciones.length ? (
        <div className="list">
          {cotizaciones.map((c) => (
            <article key={c.id} className="op">
              <div className="h"><span className="code">{c.numero}</span><span className="cli">{c.cliente}</span><span className={'pill ' + ESTADO[c.estado][0]}>{ESTADO[c.estado][1]}</span></div>
              <div className="meta">{(c.items || []).map((i) => `${i.nombre} × ${nf.format(i.cantidad)} (${decoTexto(i.deco)})`).join(' · ')}</div>
              <div className="dates">
                <span>Total: <b>{usd.format(c.total || 0)}</b></span>
                <span>Creada: <b>{fd(new Date(c.creado))}</b></span>
                {c.validez && <span>Válida hasta: <b>{fd(parseDay(c.validez))}</b></span>}
                {c.ordenes && c.ordenes.length > 0 && <span>Pedidos: <b>{c.ordenes.join(', ')}</b></span>}
              </div>
              <PasosCot c={c} M={M} hitos={hitos} perfil={perfil} supabase={supabase} avisar={avisar} recargar={recargar} />
              <div className="flags">
                <a className="btn sm" href={`/cotizacion/${c.id}`} target="_blank" rel="noreferrer">Ver / descargar PDF</a>
                {(() => { const d = documentos.find((x) => x.clave === 'doc:cot:' + c.id && x.estado === 'ok'); return d ? <a className="btn sm" href={d.url} target="_blank" rel="noreferrer">En Drive</a> : null; })()}
                {aprobar === c.id ? (
                  <div className="aprobar">
                    <label className="small muted">Entrega comprometida <input type="date" value={fechaAprob} onChange={(e) => setFechaAprob(e.target.value)} style={{ width: 'auto', display: 'inline-block' }} /></label>
                    {ocAprob ? <span className="small">OC <b>{ocAprob.campos.oc_numero || 's/n'}</b>{ocAprob.campos.oc_unidades != null ? ` · ${nf.format(ocAprob.campos.oc_unidades)} unidades` : ''}{ocAprob.campos.oc_monto != null ? ` · ${usd.format(ocAprob.campos.oc_monto)}` : ''} <button className="btn sm link" onClick={() => { setOcAprob(null); setLeerOC(true); }}>Cambiar</button></span>
                      : !leerOC && <button className="btn sm" onClick={() => setLeerOC(true)}>Adjuntar y leer la orden de compra</button>}
                    {leerOC && !ocAprob && (
                      <OCLector supabase={supabase} perfil={perfil} referencia={c.numero} textoListo="Usar esta orden de compra"
                        esperado={{ cliente: c.cliente, unidades: (c.items || []).reduce((a, i) => a + (+i.cantidad || 0), 0), monto: +c.total || 0, fecha: fechaAprob || c.fecha_entrega || '', origen: 'la cotización' }}
                        onCancel={() => setLeerOC(false)} onListo={(r) => { setOcAprob(r); setLeerOC(false); if (r.aplicar.fechaCompromiso) setFechaAprob(r.aplicar.fechaCompromiso); }} />
                    )}
                    <span className="acts">
                      <button className="btn sm primary" disabled={busy || leerOC} onClick={() => convertir(c)}>Crear {(c.items || []).length} pedido{(c.items || []).length > 1 ? 's' : ''}</button>
                      <button className="btn sm" onClick={() => { setAprobar(null); setOcAprob(null); setLeerOC(false); }}>Cancelar</button>
                    </span>
                    <p className="small muted" style={{ margin: 0 }}>Los pedidos quedan listos para enviar la orden de producción desde Pedidos.</p>
                  </div>
                ) : confirm === c.id ? (
                  <span className="acts"><span className="small muted">¿Eliminar esta cotización?</span><button className="btn sm danger" onClick={async () => { setConfirm(null); await supabase.from('cotizaciones').delete().eq('id', c.id); recargar.cotizaciones(); }}>Sí, eliminar</button><button className="btn sm" onClick={() => setConfirm(null)}>No</button></span>
                ) : (
                  <span className="acts">
                    {['borrador', 'enviada'].includes(c.estado) && <button className="btn sm" onClick={() => { setErr(''); setDraft({ ...structuredClone(c), fecha_entrega: c.fecha_entrega || '', items: c.items.map((i) => ({ ...i, precio: i.precio, manual: true })) }); window.scrollTo(0, 0); }}>Editar</button>}
                    {c.estado === 'borrador' && <button className="btn sm" onClick={() => estado(c, 'enviada')}>Marcar enviada</button>}
                    {['borrador', 'enviada'].includes(c.estado) && <button className="btn sm primary" onClick={() => { setAprobar(c.id); setFechaAprob(c.fecha_entrega || ''); }}>Aprobada → crear pedidos</button>}
                    {['borrador', 'enviada'].includes(c.estado) && <button className="btn sm" onClick={() => estado(c, 'rechazada')}>Rechazada</button>}
                    {c.estado !== 'aprobada' && <button className="btn sm danger" onClick={() => setConfirm(c.id)}>Eliminar</button>}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : !draft && <div className="empty">Aún no hay cotizaciones. Crea la primera con "Nueva cotización".</div>}
    </>
  );
}
