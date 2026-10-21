'use client';
import { useMemo, useState } from 'react';
import { DECO_NAME, fd, parseDay, nf } from '@/lib/motor';
import { usd } from '@/lib/costos';
import { decoTexto } from './ui';
import { revisarNovedades } from '@/lib/avisos';
import NuevoProducto from './NuevoProducto';

// Solicitudes de cotización: Ventas registra lo que pide el cliente y Administración o Dirección lo cotiza.
export const SOLICITUD_ROLES = ['direccion', 'jefa', 'admin', 'ventas'];
export const CANALES = { whatsapp: 'WhatsApp', instagram: 'Instagram', correo: 'Correo', llamada: 'Llamada', tienda: 'Tienda o visita', referido: 'Referido', otro: 'Otro' };
export const ESTADO_SOL = {
  nueva: ['listo', 'Nueva · por cotizar'],
  revision: ['amarillo', 'En cotización'],
  cotizada: ['listo', 'Cotizada · esperando al cliente'],
  aprobada: ['verde', 'Aprobada'],
  rechazada: ['rojo', 'Rechazada'],
  descartada: ['gris', 'Descartada'],
};
const VISTAS = { abiertas: 'Por cotizar', cotizadas: 'Cotizadas', aprobadas: 'Aprobadas', cerradas: 'Rechazadas y descartadas', todas: 'Todas' };
const enVista = { abiertas: ['nueva', 'revision'], cotizadas: ['cotizada'], aprobadas: ['aprobada'], cerradas: ['rechazada', 'descartada'] };
const COTIZAN = ['direccion', 'jefa', 'admin'];
const lineaVacia = (prod) => ({ producto: prod, cantidad: '', tallas: '', descripcion: '', deco: { tipo: 'serigrafia', colores: 1, ubicaciones: 1 } });
const dias = (a, b) => (new Date(b) - new Date(a)) / 864e5;

export default function Solicitudes({ supabase, perfil, M, perfiles = [], clientes = [], solicitudes = [], cotizaciones = [], cotizarSolicitud, avisar, recargar }) {
  const productos = M.cfg.productos;
  const primerProd = Object.keys(productos)[0];
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [nuevoProd, setNuevoProd] = useState(null); // línea en la que se está creando un producto nuevo
  const [vista, setVista] = useState('abiertas');
  const [mias, setMias] = useState(perfil.rol === 'ventas');
  const [q, setQ] = useState('');
  const [descartar, setDescartar] = useState(null); // { id, motivo }
  const cotiza = COTIZAN.includes(perfil.rol);
  const nombre = (id) => (perfiles.find((p) => p.id === id) || {}).nombre || '';
  const cotDe = (s) => cotizaciones.find((c) => c.id === s.cotizacion_id) || cotizaciones.find((c) => c.solicitud_id === s.id) || null;
  const set = (fn) => setDraft((d) => { const n = structuredClone(d); fn(n); return n; });

  function nueva() {
    setErr('');
    setDraft({ cliente: '', contacto: '', telefono: '', correo: '', canal: 'whatsapp', fecha_deseada: '', presupuesto: '', detalle: '', referencias: '', items: [lineaVacia(primerProd)] });
    window.scrollTo(0, 0);
  }
  function editar(s) {
    setErr('');
    setDraft({ ...s, presupuesto: s.presupuesto ?? '', fecha_deseada: s.fecha_deseada || '', items: (s.items || []).length ? s.items.map((i) => ({ ...lineaVacia(i.producto || primerProd), ...i })) : [lineaVacia(primerProd)] });
    window.scrollTo(0, 0);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!draft.cliente.trim()) return setErr('Escribe el cliente.');
    if (!draft.contacto.trim() && !draft.telefono.trim() && !draft.correo.trim()) return setErr('Escribe cómo contactar al cliente: persona, teléfono o correo.');
    const items = draft.items.filter((i) => +i.cantidad > 0 || i.descripcion.trim()).map((i) => ({ producto: i.producto, cantidad: Math.max(0, Math.round(+i.cantidad || 0)), tallas: i.tallas.trim(), descripcion: i.descripcion.trim(), deco: i.deco }));
    if (!items.length) return setErr('Agrega al menos un producto con la cantidad aproximada.');
    const body = {
      cliente: draft.cliente.trim(), contacto: draft.contacto.trim(), telefono: draft.telefono.trim(), correo: draft.correo.trim(), canal: draft.canal,
      fecha_deseada: draft.fecha_deseada || null, presupuesto: draft.presupuesto === '' ? null : Math.max(0, +draft.presupuesto || 0),
      detalle: draft.detalle.trim(), referencias: draft.referencias.trim(), items,
    };
    setBusy(true);
    const { data, error } = draft.id
      ? await supabase.from('solicitudes').update(body).eq('id', draft.id).select('numero').single()
      : await supabase.from('solicitudes').insert(body).select('numero').single();
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + (/solicitudes/.test(error.message) && /exist|relation/.test(error.message) ? 'falta correr la migración 11 en Supabase.' : error.message));
    avisar(draft.id ? `Solicitud ${data.numero} actualizada.` : `Solicitud ${data.numero} registrada. Administración ya puede cotizarla.`);
    setDraft(null); recargar.solicitudes(); recargar.clientes && recargar.clientes(); revisarNovedades();
  }

  async function cambiar(s, cambios, msg) {
    setBusy(true);
    const { error } = await supabase.from('solicitudes').update(cambios).eq('id', s.id);
    setBusy(false);
    if (error) return avisar('No se pudo guardar: ' + error.message);
    if (msg) avisar(msg);
    setDescartar(null); recargar.solicitudes();
  }
  async function borrar(s) {
    const { error } = await supabase.from('solicitudes').delete().eq('id', s.id);
    if (error) avisar('No se pudo eliminar: ' + error.message); else { avisar(`Solicitud ${s.numero} eliminada.`); recargar.solicitudes(); }
  }

  // Indicadores
  const k = useMemo(() => {
    const abiertas = solicitudes.filter((s) => ['nueva', 'revision'].includes(s.estado));
    const atrasadas = abiertas.filter((s) => dias(s.creado, Date.now()) > 2).length;
    const resp = solicitudes.map((s) => { const c = cotDe(s); return c ? dias(s.creado, c.creado) : null; }).filter((x) => x != null && x >= 0);
    const ap = solicitudes.filter((s) => s.estado === 'aprobada').length, re = solicitudes.filter((s) => ['rechazada', 'descartada'].includes(s.estado)).length;
    return { abiertas: abiertas.length, atrasadas, esperando: solicitudes.filter((s) => s.estado === 'cotizada').length, resp: resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : null, cierre: ap + re ? ap / (ap + re) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes, cotizaciones]);

  const qq = q.trim().toLowerCase();
  const lista = solicitudes.filter((s) => (vista === 'todas' || enVista[vista].includes(s.estado))
    && (!mias || s.vendedor_id === perfil.id)
    && (!qq || (s.numero + ' ' + s.cliente + ' ' + (s.contacto || '')).toLowerCase().includes(qq)));

  return (
    <>
      <div className="kpis" style={{ marginBottom: 14 }} data-tour="solicitudes">
        <div className="kpi"><span className="k">Por cotizar</span><span className="v">{k.abiertas}</span></div>
        <div className="kpi"><span className="k">Más de 2 días sin cotizar</span><span className={'v ' + (k.atrasadas ? 'neg' : '')}>{k.atrasadas}</span></div>
        <div className="kpi"><span className="k">Cotizadas, esperando al cliente</span><span className="v">{k.esperando}</span></div>
        <div className="kpi"><span className="k">Tiempo promedio para cotizar</span><span className="v">{k.resp == null ? '—' : k.resp < 1 ? Math.max(1, Math.round(k.resp * 24)) + ' h' : nf.format(Math.round(k.resp * 10) / 10) + (Math.round(k.resp * 10) === 10 ? ' día' : ' días')}</span></div>
        <div className="kpi"><span className="k">Tasa de cierre</span><span className="v">{k.cierre == null ? '—' : Math.round(k.cierre * 100) + '%'}</span></div>
      </div>

      <div className="toolbar">
        <input className="buscar" aria-label="Buscar solicitud" placeholder="Buscar cliente o número…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <button className="btn primary" data-tour="nueva-solicitud" onClick={nueva}>Nueva solicitud</button>
      </div>

      {draft && (
        <form className="card" onSubmit={guardar} noValidate style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>{draft.id ? 'Editar solicitud ' + draft.numero : 'Nueva solicitud del cliente'}</h3>
          <p className="small muted" style={{ margin: '0 0 10px' }}>Anota lo que pide el cliente. Con esto Administración arma la cotización: no hace falta poner precios.</p>
          <div className="fgrid">
            <label className="f">Cliente<input id="sol-cli" list="lista-clientes-sol" autoComplete="off" value={draft.cliente} onChange={(e) => { const v = e.target.value; const cl = clientes.find((x) => x.nombre === v); set((d) => { d.cliente = v; if (cl) { d.contacto = d.contacto || cl.contacto || ''; d.telefono = d.telefono || cl.telefono || ''; d.correo = d.correo || cl.correo || ''; } }); }} /></label>
            <datalist id="lista-clientes-sol">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            <label className="f">Persona de contacto<input id="sol-con" value={draft.contacto} onChange={(e) => set((d) => { d.contacto = e.target.value; })} /></label>
            <label className="f">Teléfono<input id="sol-tel" type="tel" value={draft.telefono} onChange={(e) => set((d) => { d.telefono = e.target.value; })} /></label>
            <label className="f">Correo<input id="sol-mail" type="email" value={draft.correo} onChange={(e) => set((d) => { d.correo = e.target.value; })} /></label>
            <label className="f">Llegó por<select id="sol-canal" value={draft.canal} onChange={(e) => set((d) => { d.canal = e.target.value; })}>{Object.entries(CANALES).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}</select></label>
            <label className="f">Lo necesita para (opcional)<input id="sol-fecha" type="date" value={draft.fecha_deseada} onChange={(e) => set((d) => { d.fecha_deseada = e.target.value; })} /></label>
            <label className="f">Presupuesto del cliente (opcional, US$)<input id="sol-pres" type="number" min="0" step="0.01" value={draft.presupuesto} onChange={(e) => set((d) => { d.presupuesto = e.target.value; })} /></label>
          </div>

          <h4 style={{ margin: '16px 0 6px' }}>Qué pide</h4>
          <div className="list">
            {draft.items.map((it, i) => (
              <div key={i} className="subcard">
                <div className="fgrid">
                  <label className="f">Producto<select value={it.producto} onChange={(e) => { if (e.target.value === '__nuevo') setNuevoProd(i); else set((d) => { d.items[i].producto = e.target.value; }); }}>{Object.entries(productos).map(([k2, p]) => <option key={k2} value={k2}>{p.nombre}</option>)}<option value="__nuevo">+ Agregar producto nuevo…</option></select></label>
                  <label className="f">Cantidad aproximada<input type="number" min="0" value={it.cantidad} onChange={(e) => set((d) => { d.items[i].cantidad = e.target.value; })} /></label>
                  <label className="f">Tallas (si las sabe)<input value={it.tallas} placeholder="Ej. S 20, M 40, L 40" onChange={(e) => set((d) => { d.items[i].tallas = e.target.value; })} /></label>
                  <label className="f">Estampado<select value={it.deco.tipo} onChange={(e) => set((d) => { d.items[i].deco.tipo = e.target.value; })}>{Object.entries(DECO_NAME).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}</select></label>
                  {it.deco.tipo !== 'ninguna' && <label className="f">Ubicaciones<input type="number" min="1" max="6" value={it.deco.ubicaciones} onChange={(e) => set((d) => { d.items[i].deco.ubicaciones = Math.max(1, +e.target.value || 1); })} /></label>}
                  {it.deco.tipo === 'serigrafia' && <label className="f">Colores<input type="number" min="1" max="8" value={it.deco.colores} onChange={(e) => set((d) => { d.items[i].deco.colores = Math.max(1, +e.target.value || 1); })} /></label>}
                  <label className="f" style={{ gridColumn: '1 / -1' }}>Descripción<input value={it.descripcion} placeholder="Color, tela, logo, detalles" onChange={(e) => set((d) => { d.items[i].descripcion = e.target.value; })} /></label>
                </div>
                {nuevoProd === i && <div style={{ marginTop: 10 }}><NuevoProducto supabase={supabase} cfg={M.cfg} onCancel={() => setNuevoProd(null)} onCreado={async (clave, nombre) => { if (recargar.config) await recargar.config(); set((d) => { d.items[i].producto = clave; }); setNuevoProd(null); avisar(`Producto "${nombre}" creado. Queda disponible para todos.`); }} /></div>}
                {draft.items.length > 1 && <button type="button" className="btn sm link" onClick={() => set((d) => { d.items.splice(i, 1); })}>Quitar producto</button>}
              </div>
            ))}
          </div>
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => set((d) => { d.items.push(lineaVacia(primerProd)); })}>+ Otro producto</button>

          <div className="fgrid" style={{ marginTop: 12 }}>
            <label className="f" style={{ gridColumn: '1 / -1' }}>Detalle de la solicitud<textarea id="sol-det" rows={3} value={draft.detalle} placeholder="Lo que contó el cliente: para qué es, colores, logos, ubicaciones, empaque, entrega…" onChange={(e) => set((d) => { d.detalle = e.target.value; })} /></label>
            <label className="f" style={{ gridColumn: '1 / -1' }}>Referencias (enlaces a fotos, artes o la conversación)<input id="sol-ref" value={draft.referencias} placeholder="https://…" onChange={(e) => set((d) => { d.referencias = e.target.value; })} /></label>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="formacts">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Registrar solicitud'}</button>
            <button className="btn" type="button" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="chips" style={{ margin: '0 0 12px' }}>
        {Object.entries(VISTAS).map(([k2, v]) => <button key={k2} className="chip" aria-pressed={vista === k2} onClick={() => setVista(k2)}>{v}{k2 === 'abiertas' && k.abiertas ? ` (${k.abiertas})` : ''}</button>)}
        <button className="chip" aria-pressed={mias} onClick={() => setMias(!mias)}>Solo las mías</button>
      </div>

      {lista.length ? (
        <div className="list">
          {lista.map((s) => {
            const c = cotDe(s), [cls, txt] = ESTADO_SOL[s.estado] || ['gris', s.estado];
            const abierta = ['nueva', 'revision'].includes(s.estado);
            const espera = abierta ? dias(s.creado, Date.now()) : 0;
            return (
              <article key={s.id} className="op sol">
                <div className="h"><span className="code">{s.numero}</span><span className="cli">{s.cliente}</span><span className={'pill ' + cls}>{txt}</span></div>
                <div className="meta">{(s.items || []).map((i) => `${(productos[i.producto] || {}).nombre || i.producto} × ${nf.format(+i.cantidad || 0)} (${decoTexto(i.deco)})${i.descripcion ? ' · ' + i.descripcion : ''}`).join(' · ')}</div>
                <div className="dates">
                  <span>Recibida: <b>{fd(new Date(s.creado))}</b>{abierta && espera > 2 ? <b style={{ color: 'var(--bad)' }}> · hace {Math.floor(espera)} días</b> : ''}</span>
                  <span>Por: <b>{CANALES[s.canal] || s.canal}</b>{nombre(s.vendedor_id) ? <> · Ventas: <b>{nombre(s.vendedor_id)}</b></> : ''}</span>
                  {(s.contacto || s.telefono || s.correo) && <span>Contacto: <b>{[s.contacto, s.telefono, s.correo].filter(Boolean).join(' · ')}</b></span>}
                  {s.fecha_deseada && <span>Para el: <b>{fd(parseDay(s.fecha_deseada))}</b></span>}
                  {s.presupuesto != null && <span>Presupuesto: <b>{usd.format(+s.presupuesto)}</b></span>}
                </div>
                {s.detalle && <p className="small" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{s.detalle}</p>}
                {s.referencias && <p className="small muted" style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>Referencias: {/^https?:\/\//.test(s.referencias) ? <a href={s.referencias} target="_blank" rel="noreferrer">{s.referencias}</a> : s.referencias}</p>}
                {s.estado === 'descartada' && s.motivo && <p className="small" style={{ margin: '4px 0 0', color: 'var(--bad)' }}>Motivo: {s.motivo}</p>}
                {c && (
                  <div className="sol-cot small">
                    Cotización <b>{c.numero}</b> · {usd.format(+c.total || 0)} · {c.estado}{(c.ordenes || []).length ? <> · Pedidos: <b>{c.ordenes.join(', ')}</b></> : ''}
                    <a className="btn sm" href={'/cotizacion/' + c.id} target="_blank" rel="noreferrer">Ver cotización</a>
                  </div>
                )}
                <div className="flags">
                  {cotiza && abierta && <button className="btn sm primary" onClick={() => cotizarSolicitud(s)}>Cotizar</button>}
                  {!cotiza && abierta && <span className="small muted">Esperando que Administración la cotice.</span>}
                  {abierta && (cotiza || s.vendedor_id === perfil.id) && <button className="btn sm" onClick={() => editar(s)}>Editar</button>}
                  {abierta && (descartar && descartar.id === s.id ? (
                    <span className="formacts" style={{ margin: 0 }}>
                      <input aria-label="Motivo" placeholder="Motivo (el cliente desistió, no hacemos ese producto…)" value={descartar.motivo} onChange={(e) => setDescartar({ ...descartar, motivo: e.target.value })} style={{ minWidth: 240 }} autoFocus />
                      <button className="btn sm danger" disabled={busy || !descartar.motivo.trim()} onClick={() => cambiar(s, { estado: 'descartada', motivo: descartar.motivo.trim() }, `Solicitud ${s.numero} descartada.`)}>Descartar</button>
                      <button className="btn sm" onClick={() => setDescartar(null)}>Cancelar</button>
                    </span>
                  ) : <button className="btn sm link" onClick={() => setDescartar({ id: s.id, motivo: '' })}>Descartar</button>)}
                  {s.estado === 'descartada' && <button className="btn sm" disabled={busy} onClick={() => cambiar(s, { estado: 'nueva', motivo: '' }, `Solicitud ${s.numero} reabierta.`)}>Reabrir</button>}
                  {perfil.rol === 'direccion' && !c && <button className="btn sm link" onClick={() => borrar(s)}>Eliminar</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="empty">{solicitudes.length ? 'No hay solicitudes en esta vista.' : 'Todavía no hay solicitudes. Cuando un cliente pida una cotización, regístrala con "Nueva solicitud".'}</div>}
    </>
  );
}
