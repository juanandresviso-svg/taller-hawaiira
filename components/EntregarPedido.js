'use client';
import { useState } from 'react';
import { nf } from '@/lib/motor';
import { OBS_NOTA } from '@/lib/notaEntrega';
import { revisarNovedades } from '@/lib/avisos';

// Despachar un pedido (y otros del mismo cliente que salen juntos) con su nota de entrega
export default function EntregarPedido({ o, ordenes, M, supabase, avisar, recargar, onClose }) {
  const mismoCliente = (x) => (o.clienteId && x.clienteId ? x.clienteId === o.clienteId : String(x.cliente).trim().toLowerCase() === String(o.cliente).trim().toLowerCase());
  const yaEnt = o.estado === 'entregado';
  // Otros pedidos del cliente que se pueden despachar en la misma nota
  const otros = yaEnt ? [] : ordenes.filter((x) => x.id !== o.id && x.estado === 'activo' && mismoCliente(x));
  const [sel, setSel] = useState(() => new Set([o.id, ...otros.filter((x) => (M.status[x.id] || {}).listo || (o.cotizacionId && x.cotizacionId === o.cotizacionId)).map((x) => x.id)]));
  const [obs, setObs] = useState(o.notaObs || OBS_NOTA);
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function entregar() {
    const ventana = window.open('', '_blank');
    setBusy(true);
    const { data: n, error } = await supabase.rpc('entregar_pedidos', { p_ids: [...sel], p_obs: obs });
    setBusy(false);
    if (error) { if (ventana) ventana.close(); return avisar((/function|entregar_pedidos/.test(error.message) ? 'Falta correr la migración 13 en Supabase. ' : 'No se pudo despachar: ') + error.message); }
    if (ventana) ventana.location.href = '/entrega/' + n; else window.location.href = '/entrega/' + n;
    avisar(yaEnt ? `Nota de entrega ${n} generada.` : `Despachado con la nota de entrega ${n}. Sus tiempos reales ya cuentan en los tiempos de producción.`);
    recargar.ordenes(); revisarNovedades(); onClose();
  }

  const fila = (x) => {
    const s = M.status[x.id] || {};
    return (
      <label key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={sel.has(x.id)} disabled={x.id === o.id} onChange={() => toggle(x.id)} />
        <span><b>{x.codigo}</b> · {M.prod(x).nombre} × {nf.format(x.cantidad)}{x.id !== o.id && !s.listo ? <span className="small" style={{ color: 'var(--warn)' }}> · aún en producción</span> : null}</span>
      </label>
    );
  };

  return (
    <div className="subcard" style={{ marginTop: 10 }}>
      <b className="small">{yaEnt ? 'Generar la nota de entrega' : 'Despachar con nota de entrega'} · {o.cliente}</b>
      {otros.length > 0 && <p className="small muted" style={{ margin: '6px 0' }}>Marca los pedidos de este cliente que salen en el mismo despacho: van todos en una sola nota.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>{[o, ...otros].map(fila)}</div>
      <label className="f" style={{ maxWidth: 320 }}>Observaciones de la nota<input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="POR PAGAR" /></label>
      <div className="formacts">
        <button className="btn sm primary" disabled={busy || !sel.size} onClick={entregar}>{busy ? 'Generando…' : yaEnt ? 'Generar nota de entrega' : `Despachar ${sel.size > 1 ? sel.size + ' pedidos' : ''} y generar nota`}</button>
        <button className="btn sm" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
