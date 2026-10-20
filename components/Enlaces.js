'use client';
import { useCallback, useEffect, useState } from 'react';
import { ROLES, POOLS, POOL_NAME, fd } from '@/lib/motor';

// Estación sugerida para cada rol
const EST_ROL = { operador: 'costura', diseno: 'preprensa' };
const VENCE = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['', 'No vence']];
// Juego de enlaces: uno por rol y uno por cada estación de producción
const JUEGO = [
  { rol: 'jefa' }, { rol: 'admin' }, { rol: 'ventas' }, { rol: 'compras' }, { rol: 'diseno', estacion: 'preprensa' },
  ...['corte', 'costura', 'serigrafia', 'dtf', 'bordado'].map((e) => ({ rol: 'operador', estacion: e })),
];

function nuevoToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const nombreEnlace = (i) => ROLES[i.rol] + (i.estacion ? ' · ' + POOL_NAME[i.estacion] : '');

export default function Enlaces({ supabase, perfiles, avisar }) {
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ rol: 'operador', estacion: 'costura', vence: '30', max: '', etiqueta: '' });
  const [busy, setBusy] = useState(false);
  const [verViejos, setVerViejos] = useState(false);
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = (t) => `${base}/registro/${t}`;

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('invitaciones').select('*').order('creado', { ascending: false });
    if (error) avisar('No se pudieron leer los enlaces. ¿Corriste la migración 05 en Supabase? ' + error.message);
    setLista(data || []);
  }, [supabase, avisar]);
  useEffect(() => { cargar(); }, [cargar]);

  const fila = (d) => {
    const vence = d.vence ? (() => { const v = new Date(); v.setDate(v.getDate() + +d.vence); return v.toISOString(); })() : null;
    const max = d.rol === 'direccion' ? 1 : (+d.max > 0 ? Math.round(+d.max) : null);
    return { token: nuevoToken(), activa: true, usos: 0, rol: d.rol, estacion: d.estacion || null, etiqueta: (d.etiqueta || '').trim(), vence, max_usos: max };
  };
  async function crear(filas, ok) {
    setBusy(true);
    const { error } = await supabase.from('invitaciones').insert(filas);
    setBusy(false);
    if (error) return avisar('No se pudo crear: ' + error.message);
    avisar(ok); cargar();
  }
  async function copiar(t) {
    try { await navigator.clipboard.writeText(url(t)); avisar('Enlace copiado. Pégalo en WhatsApp o en un correo.'); }
    catch { avisar('No se pudo copiar. Selecciona el enlace y cópialo a mano.'); }
  }
  async function desactivar(i) {
    const { error } = await supabase.from('invitaciones').update({ activa: false }).eq('id', i.id);
    if (error) avisar('No se pudo desactivar: ' + error.message); else { avisar('Enlace desactivado: ya nadie puede registrarse con él.'); cargar(); }
  }

  const vigente = (i) => i.activa && (!i.vence || new Date(i.vence) > new Date()) && (i.max_usos == null || i.usos < i.max_usos);
  const vigentes = lista.filter(vigente), viejos = lista.filter((i) => !vigente(i));
  const registrados = (i) => perfiles.filter((p) => p.invitacion_id === i.id);

  return (
    <>
      <h2>Enlaces de invitación por rol</h2>
      <div className="card" data-tour="enlaces">
        <p className="small muted" style={{ marginTop: 0 }}>Cada enlace registra a la persona directamente con su rol (y su estación). Quien lo abre escribe su nombre, correo y contraseña y entra de una vez. Compártelos solo con tu equipo: cualquiera que tenga el enlace puede registrarse. Te llega una notificación con cada registro.</p>
        <div className="fgrid">
          <label className="f">Rol
            <select id="en-rol" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value, estacion: EST_ROL[e.target.value] || '' })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="f">Estación
            <select id="en-est" value={f.estacion} onChange={(e) => setF({ ...f, estacion: e.target.value })}>
              <option value="">Sin estación (gestión)</option>
              {POOLS.map((p) => <option key={p} value={p}>{POOL_NAME[p]}</option>)}
            </select>
          </label>
          <label className="f">Vence en
            <select id="en-vence" value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })}>
              {VENCE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="f">Máximo de registros
            <input id="en-max" type="number" min="1" placeholder={f.rol === 'direccion' ? '1' : 'Sin límite'} disabled={f.rol === 'direccion'} value={f.rol === 'direccion' ? '1' : f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
          </label>
          <label className="f">Nota (opcional)<input id="en-nota" placeholder="Ej. nuevas operadoras de costura" value={f.etiqueta} onChange={(e) => setF({ ...f, etiqueta: e.target.value })} /></label>
        </div>
        {f.rol === 'direccion' && <p className="small" style={{ color: 'var(--warn)' }}>Un enlace de Dirección da acceso a todo (usuarios, costos, ajustes). Sirve para una sola persona.</p>}
        <div className="formacts">
          <button className="btn primary" disabled={busy} onClick={() => crear([fila(f)], `Enlace para ${nombreEnlace(f)} creado. Cópialo abajo.`)}>Crear enlace</button>
          <button className="btn" disabled={busy} onClick={() => crear(JUEGO.map((j) => fila({ ...j, vence: f.vence, max: '', etiqueta: f.etiqueta })), `Se crearon ${JUEGO.length} enlaces: uno por rol y uno por estación de producción.`)}>Crear un enlace para cada rol</button>
        </div>
      </div>

      {vigentes.length > 0 && (
        <div className="panel scroll" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Rol</th><th>Enlace</th><th className="r">Registros</th><th>Vence</th><th></th></tr></thead>
            <tbody>
              {vigentes.map((i) => (
                <tr key={i.id}>
                  <td style={{ verticalAlign: 'top' }}><b>{nombreEnlace(i)}</b>{i.etiqueta ? <div className="small muted">{i.etiqueta}</div> : null}</td>
                  <td style={{ verticalAlign: 'top' }}><input readOnly value={url(i.token)} onFocus={(e) => e.target.select()} style={{ fontSize: 12, minWidth: 220 }} aria-label="Enlace" /></td>
                  <td className="r" style={{ verticalAlign: 'top' }}><span className="num">{i.usos}{i.max_usos ? ' / ' + i.max_usos : ''}</span>{registrados(i).length > 0 && <div className="small muted">{registrados(i).map((p) => p.nombre.split(' ')[0]).join(', ')}</div>}</td>
                  <td style={{ verticalAlign: 'top' }} className="small">{i.vence ? fd(new Date(i.vence)) : 'No vence'}</td>
                  <td className="r" style={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <button className="btn sm" onClick={() => copiar(i.token)}>Copiar</button>{' '}
                    <a className="btn sm" target="_blank" rel="noreferrer" href={'https://wa.me/?text=' + encodeURIComponent(`Hola, te invito a la app del Taller Hawaiira como ${nombreEnlace(i)}. Regístrate aquí: ${url(i.token)}`)}>WhatsApp</a>{' '}
                    <button className="btn sm danger" onClick={() => desactivar(i)}>Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viejos.length > 0 && (
        <p className="small muted"><button className="btn sm link" onClick={() => setVerViejos(!verViejos)}>{verViejos ? 'Ocultar' : 'Ver'} enlaces vencidos o desactivados ({viejos.length})</button></p>
      )}
      {verViejos && (
        <div className="panel scroll">
          <table><tbody>
            {viejos.map((i) => <tr key={i.id}><td>{nombreEnlace(i)}</td><td className="small muted">{!i.activa ? 'Desactivado' : i.vence && new Date(i.vence) <= new Date() ? 'Venció ' + fd(new Date(i.vence)) : 'Sin cupos'}</td><td className="r num">{i.usos} registro{i.usos === 1 ? '' : 's'}</td></tr>)}
          </tbody></table>
        </div>
      )}
    </>
  );
}
