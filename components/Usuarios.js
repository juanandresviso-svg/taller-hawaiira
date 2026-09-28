'use client';
import { useState } from 'react';
import { ROLES, POOLS, POOL_NAME } from '@/lib/motor';

const VACIO = { nombre: '', email: '', rol: 'operador', estacion: 'costura' };

export default function Usuarios({ supabase, perfil, perfiles, avisar, recargar }) {
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function invitar(e) {
    e.preventDefault();
    setErr('');
    if (!f.nombre.trim()) return setErr('Escribe el nombre.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr('Escribe un correo válido.');
    setBusy(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error || 'No se pudo enviar la invitación.');
    avisar(j.reenviado ? `Ya existía: le reenviamos el acceso a ${f.email}.` : `Invitación enviada a ${f.email}.`);
    setF(VACIO);
    setTimeout(() => recargar.perfiles(), 800);
  }

  async function actualizar(id, cambios) {
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', id);
    if (error) avisar('No se pudo guardar: ' + error.message); else recargar.perfiles();
  }

  const activos = perfiles.filter((p) => p.activo), inactivos = perfiles.filter((p) => !p.activo);

  return (
    <>
      <h2>Invitar a una persona</h2>
      <form className="card" onSubmit={invitar} noValidate>
        <div className="fgrid">
          <label className="f">Nombre<input id="u-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          <label className="f">Correo<input id="u-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="f">Rol
            <select id="u-rol" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value, estacion: e.target.value === 'operador' ? f.estacion || 'costura' : e.target.value === 'diseno' ? 'preprensa' : '' })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="f">Estación
            <select id="u-est" value={f.estacion} onChange={(e) => setF({ ...f, estacion: e.target.value })}>
              <option value="">Sin estación (gestión)</option>
              {POOLS.map((p) => <option key={p} value={p}>{POOL_NAME[p]}</option>)}
            </select>
          </label>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="formacts">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar invitación'}</button>
          <span className="small muted">Le llegará un correo para crear su contraseña.</span>
        </div>
      </form>

      <h2>Equipo ({activos.length})</h2>
      <p className="small muted" style={{ marginTop: -4 }}>La estación define la capacidad del taller. Producción solo ve "Mi trabajo". Dirección puede todo; Jefa de taller además edita los ajustes.</p>
      <div className="panel scroll team">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estación</th><th></th></tr></thead>
          <tbody>
            {activos.map((p) => (
              <tr key={p.id}>
                <td><input id={'n-' + p.id} defaultValue={p.nombre} aria-label="Nombre" onBlur={(e) => e.target.value.trim() && e.target.value !== p.nombre && actualizar(p.id, { nombre: e.target.value.trim() })} /></td>
                <td className="muted small">{p.email}</td>
                <td>
                  <select id={'r-' + p.id} value={p.rol} aria-label="Rol" disabled={p.id === perfil.id} onChange={(e) => actualizar(p.id, { rol: e.target.value })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>
                  <select id={'e-' + p.id} value={p.estacion || ''} aria-label="Estación" onChange={(e) => actualizar(p.id, { estacion: e.target.value || null })}>
                    <option value="">Sin estación</option>
                    {POOLS.map((k) => <option key={k} value={k}>{POOL_NAME[k]}</option>)}
                  </select>
                </td>
                <td className="r">{p.id !== perfil.id && <button className="btn sm danger" onClick={() => actualizar(p.id, { activo: false })}>Desactivar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inactivos.length > 0 && (
        <>
          <h2>Desactivados ({inactivos.length})</h2>
          <div className="panel scroll">
            <table><tbody>
              {inactivos.map((p) => (
                <tr key={p.id}><td>{p.nombre}</td><td className="muted small">{p.email}</td><td className="r"><button className="btn sm" onClick={() => actualizar(p.id, { activo: true })}>Reactivar</button></td></tr>
              ))}
            </tbody></table>
          </div>
        </>
      )}
    </>
  );
}
