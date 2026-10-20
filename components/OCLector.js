'use client';
import { useState } from 'react';
import { subirArchivoOC, leerOC, OC_TIPOS } from '@/lib/oc';
import { nf, fd, parseDay } from '@/lib/motor';
import { usd } from '@/lib/costos';

const VACIO = { numero_oc: '', fecha_emision: '', cliente: { nombre: '', rif: '' }, unidades_total: '', total: '', subtotal: '', moneda: 'USD', fecha_entrega: '', condiciones_pago: '', items: [], dudas: [] };
const aNum = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);

// Orden de compra del cliente en dos pasos: 1) subir el documento y leerlo con IA, 2) revisar y completar a mano.
// esperado: { cliente, unidades, monto, fecha } del pedido o la cotización, para comparar.
export default function OCLector({ supabase, perfil, referencia, esperado = {}, textoListo = 'Guardar orden de compra', onListo, onCancel, busyExterno }) {
  const [fase, setFase] = useState('subir');
  const [file, setFile] = useState(null);
  const [archivo, setArchivo] = useState(null); // { ruta, nombre }
  const [leido, setLeido] = useState(null);     // lo que devolvió la lectura (para marcar qué se cambió a mano)
  const [d, setD] = useState(VACIO);
  const [error, setError] = useState('');
  const [aplicar, setAplicar] = useState({ unidades: true, fecha: false, monto: false });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));

  async function subirYLeer() {
    if (!file) return setError('Elige el PDF o la foto de la orden de compra.');
    setError(''); setFase('leyendo');
    const up = await subirArchivoOC(supabase, file, referencia);
    if (up.error) { setError(up.error); setFase('subir'); return; }
    setArchivo(up);
    const r = await leerOC(up.ruta);
    if (r.error) { setError(r.error + ' Completa los datos a mano.'); setLeido(null); setD({ ...VACIO }); }
    else {
      const x = { ...VACIO, ...r.datos, cliente: { ...VACIO.cliente, ...(r.datos.cliente || {}) } };
      ['unidades_total', 'total', 'subtotal'].forEach((k) => { x[k] = x[k] == null ? '' : x[k]; });
      ['fecha_emision', 'fecha_entrega'].forEach((k) => { x[k] = x[k] || ''; });
      setLeido(x); setD(x);
      if (!r.datos.legible) setError('El documento no parece una orden de compra o no se leyó bien. Revisa y completa a mano.');
    }
    setFase('revisar');
  }

  const fuente = (k, sub) => {
    if (!leido) return 'manual';
    const a = sub ? (leido[k] || {})[sub] : leido[k], b = sub ? (d[k] || {})[sub] : d[k];
    if (String(a ?? '') === '' && String(b ?? '') === '') return 'falta';
    return String(a ?? '') === String(b ?? '') ? 'leído' : 'corregido';
  };
  const Tag = ({ k, sub }) => { const f = fuente(k, sub); return <span className={'oc-tag ' + f}>{f}</span>; };

  const dinero = (v) => (d.moneda === 'USD' || !d.moneda ? usd.format(v) : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(v));
  const unidades = aNum(d.unidades_total), monto = aNum(d.total), base = aNum(d.subtotal) ?? monto;
  const difU = esperado.unidades && unidades != null && unidades !== +esperado.unidades;
  const difM = esperado.monto && base != null && Math.abs(base - esperado.monto) / esperado.monto > 0.01;
  const difF = esperado.fecha && d.fecha_entrega && d.fecha_entrega !== esperado.fecha;

  function listo() {
    if (!archivo && !d.numero_oc.trim()) return setError('Sube el documento o escribe al menos el número de la OC.');
    const ahora = new Date().toISOString();
    const manual = leido ? ['numero_oc', 'unidades_total', 'total', 'fecha_entrega'].filter((k) => fuente(k) === 'corregido') : ['todo'];
    const campos = {
      oc_numero: d.numero_oc.trim(), oc_monto: monto, oc_unidades: unidades == null ? null : Math.round(unidades), oc_fecha_entrega: d.fecha_entrega || null,
      oc_datos: { ...d, leido_con_ia: !!leido, corregido_a_mano: manual, leido_el: ahora },
      ...(archivo ? { oc_archivo: archivo.ruta, oc_nombre: archivo.nombre, oc_subida: ahora, oc_por: perfil.id } : {}),
    };
    const tallas = (d.items || []).map((i) => i.tallas).filter(Boolean).join(' · ');
    onListo({
      campos, datos: d,
      aplicar: {
        ...(aplicar.unidades && difU ? { cantidad: Math.round(unidades) } : {}),
        ...(aplicar.fecha && difF ? { fechaCompromiso: d.fecha_entrega } : {}),
        ...(aplicar.monto && difM ? { monto: base } : {}),
        ...(!esperado.cliente && d.cliente.nombre ? { cliente: d.cliente.nombre } : {}),
        ...(!esperado.unidades && unidades ? { cantidad: Math.round(unidades) } : {}),
        ...(!esperado.monto && base ? { monto: base } : {}),
        ...(!esperado.fecha && d.fecha_entrega ? { fechaCompromiso: d.fecha_entrega } : {}),
        ...(tallas ? { tallas } : {}),
      },
    });
  }

  if (fase === 'subir' || fase === 'leyendo') {
    return (
      <div className="subcard oc-lector">
        <b className="small">1 · Sube la orden de compra del cliente</b>
        <p className="small muted" style={{ margin: '4px 0 8px' }}>PDF o foto. La app la lee y propone el número de OC, el monto a pagar, las unidades y la fecha de entrega. Después los revisas y completas.</p>
        <div className="formacts" style={{ marginTop: 0 }}>
          <input id={'oc-file-' + referencia} type="file" accept={OC_TIPOS} onChange={(e) => setFile(e.target.files[0] || null)} disabled={fase === 'leyendo'} />
          <button className="btn sm primary" type="button" onClick={subirYLeer} disabled={fase === 'leyendo' || busyExterno}>{fase === 'leyendo' ? 'Leyendo la OC…' : 'Subir y leer'}</button>
          <button className="btn sm link" type="button" onClick={() => { setLeido(null); setD({ ...VACIO }); setFase('revisar'); }} disabled={fase === 'leyendo'}>Escribir los datos sin documento</button>
          {onCancel && <button className="btn sm" type="button" onClick={onCancel} disabled={fase === 'leyendo'}>Cancelar</button>}
        </div>
        {error && <div className="err" role="alert">{error}</div>}
      </div>
    );
  }

  return (
    <div className="subcard oc-lector">
      <b className="small">2 · Revisa y completa los datos de la orden de compra</b>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>
        {leido ? <>Leído con IA de <b>{archivo && archivo.nombre}</b>. Revisa cada campo: <span className="oc-tag leído">leído</span> salió del documento, <span className="oc-tag corregido">corregido</span> lo cambiaste tú y <span className="oc-tag falta">falta</span> no aparece.</> : archivo ? <>Documento subido: <b>{archivo.nombre}</b>. Escribe los datos.</> : 'Escribe los datos de la orden de compra.'}
      </p>
      {error && <div className="err" role="alert" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="fgrid">
        <label className="f"><span>N.º de OC <Tag k="numero_oc" /></span><input value={d.numero_oc} onChange={(e) => set('numero_oc', e.target.value)} /></label>
        <label className="f"><span>Cliente según la OC <Tag k="cliente" sub="nombre" /></span><input value={d.cliente.nombre || ''} onChange={(e) => set('cliente', { ...d.cliente, nombre: e.target.value })} /></label>
        <label className="f"><span>Unidades <Tag k="unidades_total" /></span><input type="number" min="0" value={d.unidades_total} onChange={(e) => set('unidades_total', e.target.value)} /></label>
        <label className="f"><span>Monto total a pagar <Tag k="total" /></span><input type="number" min="0" step="0.01" value={d.total} onChange={(e) => set('total', e.target.value)} /></label>
        <label className="f">Moneda<select value={d.moneda || 'USD'} onChange={(e) => set('moneda', e.target.value)}><option value="USD">US$</option><option value="VES">Bolívares</option><option value="EUR">Euros</option></select></label>
        <label className="f"><span>Fecha de entrega pedida <Tag k="fecha_entrega" /></span><input type="date" value={d.fecha_entrega || ''} onChange={(e) => set('fecha_entrega', e.target.value)} /></label>
        <label className="f">Fecha de la OC<input type="date" value={d.fecha_emision || ''} onChange={(e) => set('fecha_emision', e.target.value)} /></label>
        <label className="f">Condiciones de pago<input value={d.condiciones_pago || ''} onChange={(e) => set('condiciones_pago', e.target.value)} /></label>
      </div>
      {d.subtotal !== '' && d.subtotal != null && <p className="small muted" style={{ margin: '6px 0 0' }}>Subtotal sin impuestos: {d.moneda === 'USD' || !d.moneda ? usd.format(+d.subtotal) : nf.format(+d.subtotal)}{d.impuesto ? ` · Impuestos: ${d.moneda === 'USD' || !d.moneda ? usd.format(+d.impuesto) : nf.format(+d.impuesto)}` : ''}</p>}
      {(d.items || []).length > 0 && (
        <div className="scroll" style={{ marginTop: 8 }}>
          <table className="oc-items">
            <thead><tr><th>Descripción</th><th className="r">Cant.</th><th>Tallas</th><th className="r">Precio</th><th className="r">Total</th></tr></thead>
            <tbody>{d.items.map((i, k) => <tr key={k}><td>{i.descripcion}</td><td className="r">{i.cantidad != null ? nf.format(i.cantidad) : '—'}</td><td>{i.tallas || '—'}</td><td className="r">{i.precio_unitario != null ? dinero(i.precio_unitario) : '—'}</td><td className="r">{i.total != null ? dinero(i.total) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {(d.dudas || []).length > 0 && <p className="small" style={{ color: 'var(--warn)', margin: '6px 0 0' }}>Revisar: {d.dudas.join(' · ')}</p>}

      {(difU || difM || difF) && (
        <div className="oc-dif">
          <b className="small">Diferencias con {esperado.origen || 'el pedido'}</b>
          {difU && <label><input type="checkbox" checked={aplicar.unidades} onChange={(e) => setAplicar({ ...aplicar, unidades: e.target.checked })} />Unidades: OC <b>{nf.format(unidades)}</b> · {esperado.origen || 'pedido'} <b>{nf.format(esperado.unidades)}</b>. Usar las de la OC.</label>}
          {difM && <label><input type="checkbox" checked={aplicar.monto} onChange={(e) => setAplicar({ ...aplicar, monto: e.target.checked })} />Monto: OC <b>{usd.format(base)}</b>{aNum(d.subtotal) != null ? ' sin impuestos' : ''} · {esperado.origen || 'pedido'} <b>{usd.format(esperado.monto)}</b>. Usar el de la OC.</label>}
          {difF && <label><input type="checkbox" checked={aplicar.fecha} onChange={(e) => setAplicar({ ...aplicar, fecha: e.target.checked })} />Entrega: OC <b>{fd(parseDay(d.fecha_entrega))}</b> · {esperado.origen || 'pedido'} <b>{fd(parseDay(esperado.fecha))}</b>. Usar la de la OC.</label>}
        </div>
      )}
      <div className="formacts">
        <button className="btn sm primary" type="button" onClick={listo} disabled={busyExterno}>{textoListo}</button>
        <button className="btn sm" type="button" onClick={() => { setFase('subir'); setError(''); }}>Subir otro documento</button>
        {onCancel && <button className="btn sm" type="button" onClick={onCancel}>Cancelar</button>}
      </div>
    </div>
  );
}
