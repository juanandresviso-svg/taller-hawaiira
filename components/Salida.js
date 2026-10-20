'use client';
import { useState } from 'react';
import { nf1 } from '@/lib/motor';

// Registrar material que sale del almacén para un pedido (alimenta el costo real).
export default function Salida({ supabase, orden, materiales, consumos, avisar, onClose, puedeBorrar }) {
  const [mat, setMat] = useState('');
  const [cant, setCant] = useState('');
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const activos = materiales.filter((m) => m.activo !== false);
  const m = materiales.find((x) => x.id === mat);
  const mias = consumos.filter((c) => c.orden_id === orden.id);

  async function guardar(e) {
    e.preventDefault();
    if (!mat) return setErr('Elige el material.');
    if (!(+cant > 0)) return setErr('Escribe la cantidad que sale.');
    setBusy(true);
    const { error } = await supabase.from('consumos').insert({ orden_id: orden.id, material_id: mat, cantidad: +cant, nota: nota.trim() });
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + error.message);
    avisar(`Salida registrada: ${cant} ${m ? m.unidad : ''} de ${m ? m.nombre : 'material'} para ${orden.codigo}.`);
    setCant(''); setNota(''); setErr('');
  }
  async function borrar(id) {
    const { error } = await supabase.from('consumos').delete().eq('id', id);
    if (error) avisar('No se pudo borrar: ' + error.message);
  }

  return (
    <form className="subcard" onSubmit={guardar} noValidate>
      <b className="small">Salida de material · {orden.codigo}</b>
      <div className="fgrid" style={{ marginTop: 8 }}>
        <label className="f">Material
          <select id={'sal-mat-' + orden.id} value={mat} onChange={(e) => setMat(e.target.value)}>
            <option value="">Elegir…</option>
            {activos.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.unidad}) · stock {nf1.format(x.stock)}</option>)}
          </select>
        </label>
        <label className="f">Cantidad{m ? ` (${m.unidad})` : ''}<input id={'sal-cant-' + orden.id} type="number" step="0.01" min="0" value={cant} onChange={(e) => setCant(e.target.value)} /></label>
        <label className="f">Nota (opcional)<input id={'sal-nota-' + orden.id} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. lote 23, tela negra" /></label>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="formacts" style={{ marginTop: 8 }}>
        <button className="btn sm primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Registrar salida'}</button>
        <button className="btn sm" type="button" onClick={onClose}>Cerrar</button>
      </div>
      {mias.length > 0 && (
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>Material</th><th className="r">Cantidad</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            {mias.map((c) => { const mm = materiales.find((x) => x.id === c.material_id); return (
              <tr key={c.id}><td>{mm ? mm.nombre : '—'}</td><td className="r">{nf1.format(c.cantidad)} {mm ? mm.unidad : ''}</td><td className="small muted">{c.nota}</td>
                <td className="r">{puedeBorrar && <button type="button" className="btn sm" onClick={() => borrar(c.id)}>Quitar</button>}</td></tr>
            ); })}
          </tbody>
        </table>
      )}
    </form>
  );
}
