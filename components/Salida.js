'use client';
import { useState } from 'react';
import { nf1 } from '@/lib/motor';
import { usd } from '@/lib/costos';
import { revisarNovedades } from '@/lib/avisos';
import AgregarMaterial, { agregarMaterialPedido, totalMateriales } from './AgregarMaterial';

// Materiales de un pedido: se eligen de la lista de precios y la app calcula el total (alimenta el costo real).
export default function Salida({ supabase, orden, materiales, consumos, avisar, onClose, puedeBorrar, recargar }) {
  const [busy, setBusy] = useState(false);
  const mias = consumos.filter((c) => c.orden_id === orden.id);

  async function agregar(f) {
    setBusy(true);
    const r = await agregarMaterialPedido(supabase, orden.id, f, materiales);
    setBusy(false);
    if (r.error) { avisar('No se pudo guardar: ' + r.error.message); return false; }
    avisar(`${orden.codigo}: ${nf1.format(+f.cantidad)} ${r.m ? r.m.unidad : ''} de ${r.m ? r.m.nombre : 'material'} · ${usd.format(r.total)}.`);
    recargar && recargar.consumos && recargar.consumos();
    recargar && recargar.materiales && recargar.materiales();
    revisarNovedades();
    return true;
  }
  async function borrar(id) {
    const { error } = await supabase.from('consumos').delete().eq('id', id);
    if (error) avisar('No se pudo quitar: ' + error.message); else recargar && recargar.consumos && recargar.consumos();
  }

  return (
    <div className="subcard">
      <b className="small">Materiales del pedido · {orden.codigo}</b>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>Elige el material de la lista de precios, pon la cantidad y la app calcula el total. Si lo pagaste a otro precio, cámbialo antes de agregarlo.</p>
      <AgregarMaterial materiales={materiales} idBase={'sal-' + orden.id} busy={busy} onAgregar={agregar} />
      {mias.length > 0 && (
        <div className="scroll">
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Material</th><th className="r">Cantidad</th><th className="r">Precio</th><th className="r">Total</th><th></th></tr></thead>
            <tbody>
              {mias.map((c) => { const mm = materiales.find((x) => x.id === c.material_id); return (
                <tr key={c.id}><td>{mm ? mm.nombre : '—'}{c.nota ? <div className="small muted">{c.nota}</div> : null}</td><td className="r nowrap">{nf1.format(c.cantidad)} {mm ? mm.unidad : ''}</td><td className="r">{usd.format(+c.costo_unit || 0)}</td><td className="r">{usd.format(c.cantidad * (+c.costo_unit || 0))}</td>
                  <td className="r">{puedeBorrar && <button type="button" className="btn sm" onClick={() => borrar(c.id)}>Quitar</button>}</td></tr>
              ); })}
            </tbody>
            <tfoot><tr><th colSpan={3}>Total de materiales</th><th className="r">{usd.format(totalMateriales(mias))}</th><th /></tr></tfoot>
          </table>
        </div>
      )}
      <div className="formacts" style={{ marginTop: 8 }}><button className="btn sm" type="button" onClick={onClose}>Cerrar</button></div>
    </div>
  );
}
