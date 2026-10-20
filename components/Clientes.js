'use client';
import { useMemo, useState } from 'react';
import { nf, fd, parseDay, pct } from '@/lib/motor';
import { usd, usd0 } from '@/lib/costos';
import { pasosDe, cotizacionDe } from '@/lib/proceso';

const diaCaracas = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(d));
const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
const CAMPOS = [['nombre', 'Nombre'], ['rif', 'RIF'], ['contacto', 'Persona de contacto'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['direccion', 'Dirección']];

// Estadísticas de cada cliente a partir de sus pedidos y cotizaciones
export function estadisticas({ clientes, ordenes, cotizaciones, hitos, M }) {
  const hitosDe = {}, hitosCotDe = {};
  hitos.forEach((h) => { if (h.orden_id) (hitosDe[h.orden_id] = hitosDe[h.orden_id] || []).push(h); if (h.cotizacion_id) (hitosCotDe[h.cotizacion_id] = hitosCotDe[h.cotizacion_id] || []).push(h); });
  const porClave = Object.fromEntries(clientes.map((c) => [clave(c.nombre), c.id]));
  const idDe = (x) => x.clienteId || x.cliente_id || porClave[clave(x.cliente)] || null;
  const E = Object.fromEntries(clientes.map((c) => [c.id, { c, pedidos: [], cots: [], unidades: 0, vendido: 0, porCobrar: 0, activos: 0, entregados: 0, aTiempo: 0, prods: {}, ultimo: null }]));
  ordenes.forEach((o) => {
    const e = E[idDe(o)]; if (!e) return;
    e.pedidos.push(o);
    e.unidades += +o.cantidad || 0; e.vendido += +o.monto || 0;
    e.prods[o.producto] = (e.prods[o.producto] || 0) + (+o.cantidad || 0);
    if (!e.ultimo || o.creado > e.ultimo) e.ultimo = o.creado;
    if (o.estado === 'entregado') {
      e.entregados++;
      if (o.entregado && o.fechaCompromiso && diaCaracas(o.entregado) <= String(o.fechaCompromiso).slice(0, 10)) e.aTiempo++;
      const S = pasosDe(o, { M, hitos: hitosDe[o.id] || [], hitosCot: hitosCotDe[o.cotizacionId] || [], cot: cotizacionDe(o, cotizaciones) });
      if (!S.cerrado) e.porCobrar += +o.monto || 0;
    } else e.activos++;
  });
  cotizaciones.forEach((c) => { const e = E[idDe(c)]; if (e) e.cots.push(c); });
  return Object.values(E).map((e) => {
    const aprob = e.cots.filter((c) => c.estado === 'aprobada').length, rech = e.cots.filter((c) => c.estado === 'rechazada').length;
    const prodTop = Object.entries(e.prods).sort((a, b) => b[1] - a[1])[0];
    return { ...e, aprobadas: aprob, tasa: aprob + rech ? aprob / (aprob + rech) : null, puntualidad: e.entregados ? e.aTiempo / e.entregados : null, ticket: e.pedidos.length ? e.vendido / e.pedidos.length : 0, prodTop: prodTop ? prodTop[0] : null };
  });
}

export default function Clientes({ supabase, perfil, clientes = [], ordenes, cotizaciones = [], hitos = [], M, avisar, recargar }) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('vendido');
  const [abierto, setAbierto] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const stats = useMemo(() => estadisticas({ clientes, ordenes, cotizaciones, hitos, M }), [clientes, ordenes, cotizaciones, hitos, M]);
  const lista = stats.filter((e) => !q || clave(e.c.nombre).includes(clave(q)) || clave(e.c.rif).includes(clave(q)))
    .sort((a, b) => (orden === 'nombre' ? a.c.nombre.localeCompare(b.c.nombre) : orden === 'ultimo' ? String(b.ultimo || '').localeCompare(String(a.ultimo || '')) : b[orden] - a[orden]));
  const conPedidos = stats.filter((e) => e.pedidos.length);
  const total = conPedidos.reduce((a, e) => a + e.vendido, 0);
  const hace90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const top = conPedidos.slice().sort((a, b) => b.vendido - a.vendido)[0];
  const nombreProd = (k) => (M.cfg.productos[k] || {}).nombre || k;

  async function guardar(e) {
    e.preventDefault();
    if (!String(form.nombre || '').trim()) return avisar('Escribe el nombre del cliente.');
    setBusy(true);
    const datos = Object.fromEntries(CAMPOS.map(([k]) => [k, String(form[k] || '').trim()]));
    datos.notas = String(form.notas || '').trim();
    const r = form.id
      ? await supabase.from('clientes').update(datos).eq('id', form.id)
      : await supabase.from('clientes').insert({ ...datos, clave: clave(datos.nombre) });
    setBusy(false);
    if (r.error) return avisar('No se pudo guardar: ' + (/duplicate|clave/.test(r.error.message) ? 'ya existe un cliente con ese nombre.' : r.error.message));
    avisar(form.id ? 'Cliente actualizado.' : 'Cliente creado.');
    setForm(null); recargar.clientes();
  }

  return (
    <>
      <h2>Clientes</h2>
      <div className="summary">
        <div><span className="k">Clientes con pedidos</span><span className="v">{conPedidos.length}</span></div>
        <div><span className="k">Activos (últimos 90 días)</span><span className="v">{conPedidos.filter((e) => e.ultimo && e.ultimo >= hace90).length}</span></div>
        <div><span className="k">Vendido en pedidos</span><span className="v">{usd0.format(total)}</span></div>
        <div><span className="k">Por cobrar</span><span className={'v ' + (stats.some((e) => e.porCobrar) ? 'warn' : '')}>{usd0.format(stats.reduce((a, e) => a + e.porCobrar, 0))}</span></div>
        <div><span className="k">Cliente principal</span><span className="v" style={{ fontSize: 17 }}>{top ? top.c.nombre : '—'} <small>{top && total ? pct(top.vendido / total) + ' de las ventas' : ''}</small></span></div>
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <input id="cli-buscar" placeholder="Buscar por nombre o RIF" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <div className="chips" style={{ margin: 0 }}>
          {[['vendido', 'Más vendido'], ['unidades', 'Más unidades'], ['ultimo', 'Más reciente'], ['nombre', 'Nombre']].map(([k, v]) => <button key={k} className="chip" aria-pressed={orden === k} onClick={() => setOrden(k)}>{v}</button>)}
        </div>
        <button className="btn primary" onClick={() => setForm({ nombre: '' })}>Nuevo cliente</button>
      </div>

      {form && (
        <form className="card" style={{ marginBottom: 14 }} onSubmit={guardar} noValidate>
          <h3 style={{ marginBottom: 10 }}>{form.id ? 'Editar ' + form.nombre : 'Nuevo cliente'}</h3>
          <div className="fgrid">{CAMPOS.map(([k, l]) => <label key={k} className="f">{l}<input id={'cli-' + k} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}</div>
          <label className="f" style={{ marginTop: 10 }}>Notas<textarea id="cli-notas" rows={2} value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></label>
          {form.id && <p className="small muted">Si cambias el nombre aquí, los pedidos y cotizaciones de este cliente lo siguen mostrando con el nombre con que se crearon.</p>}
          <div className="formacts"><button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}

      {lista.length ? (
        <div className="panel scroll">
          <table className="clientes-t">
            <thead><tr><th>Cliente</th><th className="r">Pedidos</th><th className="r">Unidades</th><th className="r">Vendido</th><th className="r">Ticket prom.</th><th className="r">Por cobrar</th><th className="r">Cotizaciones</th><th className="r">A tiempo</th><th>Último pedido</th></tr></thead>
            <tbody>
              {lista.map((e) => (
                <FilaCliente key={e.c.id} e={e} abierto={abierto === e.c.id} onAbrir={() => setAbierto(abierto === e.c.id ? null : e.c.id)} onEditar={() => setForm({ ...e.c })} nombreProd={nombreProd} />
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">{clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes. Se crean solos al registrar pedidos o cotizaciones, o con "Nuevo cliente".'}</div>}
    </>
  );
}

function FilaCliente({ e, abierto, onAbrir, onEditar, nombreProd }) {
  const c = e.c;
  return (
    <>
      <tr className={'cli' + (abierto ? ' abierto' : '')} onClick={onAbrir} style={{ cursor: 'pointer' }}>
        <td><b>{c.nombre}</b>{c.rif && <div className="small muted">{c.rif}</div>}</td>
        <td className="r">{e.pedidos.length}{e.activos ? <div className="small muted">{e.activos} en curso</div> : null}</td>
        <td className="r">{nf.format(e.unidades)}</td>
        <td className="r">{usd0.format(e.vendido)}</td>
        <td className="r">{e.pedidos.length ? usd0.format(e.ticket) : '—'}</td>
        <td className="r" style={e.porCobrar ? { color: 'var(--warn)' } : null}>{e.porCobrar ? usd0.format(e.porCobrar) : '—'}</td>
        <td className="r">{e.cots.length ? <>{e.aprobadas}/{e.cots.length}{e.tasa != null && <div className="small muted">{pct(e.tasa)} aprobadas</div>}</> : '—'}</td>
        <td className="r">{e.puntualidad != null ? pct(e.puntualidad) : '—'}</td>
        <td>{e.ultimo ? fd(new Date(e.ultimo)) : '—'}</td>
      </tr>
      {abierto && (
        <tr className="detalle"><td colSpan={9}>
          <div className="cli-det">
            <div>
              <div className="small muted">{[c.contacto, c.telefono, c.correo, c.direccion].filter(Boolean).join(' · ') || 'Sin datos de contacto.'}</div>
              {e.prodTop && <div className="small">Producto principal: <b>{nombreProd(e.prodTop)}</b></div>}
              {c.notas && <div className="small muted">{c.notas}</div>}
              <button className="btn sm" style={{ marginTop: 6 }} onClick={(ev) => { ev.stopPropagation(); onEditar(); }}>Editar datos</button>
            </div>
            <div>
              <b className="small">Pedidos</b>
              <ul className="small">{e.pedidos.slice().sort((a, b) => String(b.creado).localeCompare(String(a.creado))).slice(0, 12).map((o) => <li key={o.id}><span className="code">{o.codigo}</span> {nombreProd(o.producto)} × {nf.format(o.cantidad)} · {usd.format(o.monto || 0)} · {o.estado === 'entregado' ? 'entregado' : o.estado === 'espera' ? 'por enviar OP' : 'en producción'} · compromiso {fd(parseDay(o.fechaCompromiso))}</li>)}</ul>
              {e.cots.length > 0 && <><b className="small">Cotizaciones</b><ul className="small">{e.cots.slice(0, 8).map((x) => <li key={x.id}><span className="code">{x.numero}</span> {usd.format(+x.total || 0)} · {x.estado}</li>)}</ul></>}
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}
