'use client';
import { ETAPAS } from '@/lib/equipo';
import { STAGE_NAME, DECO_NAME } from '@/lib/motor';

// Ajustes → Equipos y máquinas: lo que la app sugiere para cada etapa del pedido
export default function Equipos({ equipos, productos, onChange }) {
  const set = (i, campo, v) => onChange(equipos.map((e, k) => (k === i ? { ...e, [campo]: v } : e)));
  const alternar = (i, tag) => { const p = new Set(equipos[i].para || []); p.has(tag) ? p.delete(tag) : p.add(tag); set(i, 'para', [...p]); };
  const etiquetas = [...Object.entries(productos).map(([k, p]) => [k, p.nombre]), ...Object.entries(DECO_NAME).filter(([k]) => k !== 'ninguna').map(([k, v]) => ['deco:' + k, v])];
  return (
    <div className="panel scroll" data-tour="equipos">
      <p className="small muted" style={{ marginTop: 0 }}>Máquinas de cada etapa. Al enviar una orden de producción la app sugiere las máquinas de cada etapa y las personas de cada estación. "Solo para" limita una máquina a ciertos productos o estampados; sin marcar, sirve para todo. La lista inicial es un ejemplo: ajústala a tu taller.</p>
      <table className="equipos-t">
        <thead><tr><th>Máquina o equipo</th><th>Etapa</th><th className="r">Cantidad</th><th>Solo para</th><th /></tr></thead>
        <tbody>
          {equipos.map((e, i) => (
            <tr key={e.id || i}>
              <td><input id={'eq-n-' + i} aria-label="Nombre" value={e.nombre} onChange={(ev) => set(i, 'nombre', ev.target.value)} /></td>
              <td><select id={'eq-e-' + i} aria-label="Etapa" value={e.etapa} onChange={(ev) => set(i, 'etapa', ev.target.value)}>{ETAPAS.map((s) => <option key={s} value={s}>{STAGE_NAME[s]}</option>)}</select></td>
              <td className="r"><input id={'eq-c-' + i} aria-label="Cantidad" type="number" min="0" value={e.cantidad} onChange={(ev) => set(i, 'cantidad', Math.max(0, +ev.target.value || 0))} style={{ width: 70 }} /></td>
              <td><div className="tags">{etiquetas.map(([t, l]) => <button type="button" key={t} className="chip" aria-pressed={(e.para || []).includes(t)} onClick={() => alternar(i, t)}>{l}</button>)}</div></td>
              <td><button type="button" className="btn sm link" onClick={() => onChange(equipos.filter((_, k) => k !== i))}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="formacts"><button type="button" className="btn sm" onClick={() => onChange([...equipos, { id: 'eq-' + Date.now(), nombre: '', etapa: 'costura', cantidad: 1, para: [] }])}>Agregar máquina</button></div>
    </div>
  );
}
