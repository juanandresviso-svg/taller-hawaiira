'use client';
import { useMemo, useState } from 'react';
import { crearMotor, fd, parseDay, nf } from '@/lib/motor';
import { usd } from '@/lib/costos';
import { sugerirEquipo, equiposDe } from '@/lib/equipo';
import { verOC } from '@/lib/oc';
import { revisarNovedades } from '@/lib/avisos';
import OCLector from './OCLector';

// Equipo sugerido (personas y máquinas por etapa)
export function TablaEquipo({ equipo }) {
  return (
    <div className="scroll">
      <table className="equipo">
        <thead><tr><th>Etapa</th><th>Inicio</th><th>Personas sugeridas</th><th>Máquinas</th></tr></thead>
        <tbody>
          {equipo.map((e) => (
            <tr key={e.etapa} className={e.hecho ? 'hecho' : ''}>
              <td><b>{e.nombre}</b><div className="small muted">{e.estacion}</div></td>
              <td>{e.externo ? 'Taller aliado' : e.hecho ? 'Terminada' : e.inicio ? fd(e.inicio) : '—'}</td>
              <td>{e.externo || e.hecho ? '—' : e.personas.length ? <>{e.personas.join(', ')}<div className="small muted">{e.necesarias} de {e.disponibles} · {nf.format(e.horas)} h de trabajo</div></> : <span className="small" style={{ color: 'var(--warn)' }}>Nadie asignado a {e.estacion} (Usuarios)</span>}</td>
              <td className="small">{e.maquinas.length ? e.maquinas.map((m) => m.nombre + (m.cantidad > 1 ? ' ×' + m.cantidad : '')).join(' · ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Equipo sugerido y fecha proyectada de un pedido, como si ya estuviera en el plan
export function useEquipo(o, { M, perfiles, registros, config }) {
  return useMemo(() => {
    const comoActivo = { ...o, estado: 'activo' };
    const M2 = o.estado === 'activo' ? M : crearMotor({ config: M.cfg, ordenes: [...M.activos.filter((x) => x.id !== o.id), comoActivo], perfiles });
    return { equipo: sugerirEquipo(comoActivo, { M: M2, perfiles, registros, equipos: equiposDe(config) }), status: M2.status[o.id] || null };
  }, [o, M, perfiles, registros, config]);
}

// Enviar la orden de producción al taller (después de aprobar la cotización)
export default function EnviarOP({ o, cot = null, supabase, perfil, M, perfiles, registros, config, avisar, recargar, onClose, reenviar = false }) {
  const [oc, setOc] = useState(null);          // OC leída y revisada (se guarda al enviar)
  const [cambiarOC, setCambiarOC] = useState(!o.ocArchivo && !o.ocNumero && !reenviar);
  const [sinOC, setSinOC] = useState(false);
  const [push, setPush] = useState(true);
  const [correo, setCorreo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const { equipo, status } = useEquipo(o, { M, perfiles, registros, config });
  const tieneOC = !!(oc || o.ocArchivo || o.ocNumero);

  async function guardarOC() {
    if (!oc) return;
    setBusy(true);
    const { error } = await supabase.from('ordenes').update({ ...oc.campos, ...colAplicar(oc.aplicar) }).eq('id', o.id);
    setBusy(false);
    if (error) return setErr('No se pudo guardar la OC: ' + error.message);
    avisar(`${o.codigo}: orden de compra guardada.`); recargar.ordenes(); onClose();
  }

  async function enviar() {
    setErr('');
    if (!reenviar && !tieneOC && !sinOC) return setErr(perfil.rol === 'direccion' ? 'Sube la orden de compra o marca "Enviar sin orden de compra".' : 'Sube la orden de compra del cliente para enviar la orden de producción.');
    setBusy(true);
    if (!reenviar) {
      const ahora = new Date().toISOString();
      const upd = { ...(oc ? { ...oc.campos, ...colAplicar(oc.aplicar) } : {}), estado: 'activo', activado: o.activado || ahora, op_enviada: ahora, op_enviada_por: perfil.id };
      const { error } = await supabase.from('ordenes').update(upd).eq('id', o.id);
      if (error) { setBusy(false); return setErr('No se pudo guardar: ' + error.message); }
      // Enviar la orden de producción confirma que el cliente aceptó la cotización
      if (cot && cot.estado !== 'aprobada') await supabase.from('cotizaciones').update({ estado: 'aprobada', fecha_entrega: cot.fecha_entrega || o.fechaCompromiso }).eq('id', cot.id);
    }
    let r = null;
    try {
      const resp = await fetch('/api/op/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordenId: o.id, push, correo }) });
      r = await resp.json();
      if (!resp.ok) throw new Error(r.error || 'No se pudo enviar.');
    } catch (e) { r = { error: e.message }; }
    setBusy(false);
    setRes(r);
    recargar.ordenes(); recargar.hitos && recargar.hitos(); recargar.documentos && recargar.documentos();
    revisarNovedades();
  }

  if (res) {
    const wa = res.whatsapp ? 'https://wa.me/?text=' + encodeURIComponent(res.whatsapp) : null;
    return (
      <div className="subcard enviar-op">
        <b>{res.error ? `${o.codigo}: el pedido quedó activo, pero el envío tuvo un problema` : `Orden de producción ${o.codigo} enviada al taller`}</b>
        {res.error ? <p className="small" style={{ color: 'var(--bad)' }}>{res.error}. Puedes reenviarla desde Seguimiento.</p> : (
          <p className="small muted" style={{ margin: '4px 0' }}>
            {res.push ? `${res.push} notificación${res.push > 1 ? 'es' : ''}` : 'Sin notificaciones'} · {res.correo ? `correo a ${res.correo} persona${res.correo > 1 ? 's' : ''}${res.pdf ? ' con el PDF' : ''}` : 'sin correo'}
            {(res.avisos || []).length ? <><br />{res.avisos.join(' · ')}</> : null}
          </p>
        )}
        <div className="formacts">
          {wa && <a className="btn sm primary" href={wa} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>}
          {res.pdf && <a className="btn sm" href={res.pdf} target="_blank" rel="noreferrer">Ver PDF</a>}
          <button className="btn sm" onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  const fin = status && status.endDate, comp = parseDay(o.fechaCompromiso);
  return (
    <div className="subcard enviar-op">
      <b>{reenviar ? 'Reenviar' : 'Enviar'} la orden de producción · {o.codigo}</b>
      <p className="small muted" style={{ margin: '4px 0 10px' }}>{reenviar ? 'Vuelve a avisar al taller y a compartir la orden.' : 'La orden de producción entra en el plan del taller, se guarda en PDF en Google Drive y se avisa al jefe de taller, a compras y al dueño del pedido.'}</p>

      {!reenviar && (
        <section>
          <h4>Cotización</h4>
          <p className="small" style={{ margin: 0 }}>{cot ? <>Cotización <b>{cot.numero}</b> · {cot.estado === 'aprobada' ? 'aprobada' : `${cot.estado}: al enviar la orden de producción queda aprobada`} · <a href={'/cotizacion/' + cot.id} target="_blank" rel="noreferrer">Ver</a></> : o.cotizacionId ? 'Cotización generada.' : <span style={{ color: 'var(--warn)' }}>Sin cotización (envío autorizado por Dirección).</span>}</p>
        </section>
      )}
      {!reenviar && (
        <section>
          <h4>Orden de compra del cliente</h4>
          {cambiarOC ? (
            <OCLector supabase={supabase} perfil={perfil} referencia={o.codigo} busyExterno={busy}
              esperado={{ cliente: o.cliente, unidades: o.cantidad, monto: o.monto, fecha: o.fechaCompromiso, origen: 'el pedido' }}
              textoListo="Usar esta orden de compra" onListo={(r) => { setOc(r); setCambiarOC(false); }} onCancel={tieneOC ? () => setCambiarOC(false) : null} />
          ) : (
            <div className="oc-resumen small">
              {oc ? <>OC <b>{oc.campos.oc_numero || 's/n'}</b>{oc.campos.oc_unidades != null ? ` · ${nf.format(oc.campos.oc_unidades)} unidades` : ''}{oc.campos.oc_monto != null ? ` · ${usd.format(oc.campos.oc_monto)}` : ''} · se guarda al enviar{Object.keys(oc.aplicar).length ? ' · actualiza ' + Object.keys(oc.aplicar).map((k) => ({ cantidad: 'cantidad', fechaCompromiso: 'fecha', monto: 'monto', tallas: 'tallas', cliente: 'cliente' }[k])).join(', ') : ''}</>
                : o.ocArchivo || o.ocNumero ? <>OC <b>{o.ocNumero || 's/n'}</b>{o.ocUnidades != null ? ` · ${nf.format(o.ocUnidades)} unidades` : ''}{o.ocMonto != null ? ` · ${usd.format(o.ocMonto)}` : ''}{o.ocArchivo && <> · <button className="btn link sm" onClick={async () => { const e = await verOC(supabase, o.ocArchivo); if (e) avisar(e); }}>Ver</button></>}</>
                : 'Sin orden de compra.'}
              <button className="btn sm" onClick={() => setCambiarOC(true)}>{tieneOC ? 'Cambiar' : 'Subir OC'}</button>
              {oc && <button className="btn sm" onClick={guardarOC} disabled={busy}>Guardar OC sin enviar</button>}
            </div>
          )}
          {!tieneOC && perfil.rol === 'direccion' && !cambiarOC && <label className="small"><input type="checkbox" checked={sinOC} onChange={(e) => setSinOC(e.target.checked)} /> Enviar sin orden de compra (Dirección)</label>}
        </section>
      )}

      <section>
        <h4>Equipo sugerido</h4>
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          Fecha comprometida <b>{fd(comp)}</b>{fin ? <> · fecha proyectada <b style={{ color: fin > comp ? 'var(--bad)' : 'var(--ok)' }}>{fd(fin)}</b>{fin > comp ? ' (se va tarde: revisa la carga en el Tablero)' : ''}</> : ''}
        </p>
        <TablaEquipo equipo={equipo} />
      </section>

      <section>
        <h4>Avisar</h4>
        <div className="checks" style={{ marginTop: 0 }}>
          <label><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />Notificación en la app</label>
          <label><input type="checkbox" checked={correo} onChange={(e) => setCorreo(e.target.checked)} />Correo con el PDF</label>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Al terminar aparece el botón para compartirla por WhatsApp.</p>
      </section>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="formacts">
        <button className="btn primary" onClick={enviar} disabled={busy || (cambiarOC && !reenviar)}>{busy ? 'Enviando…' : reenviar ? 'Reenviar orden de producción' : 'Enviar orden de producción'}</button>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

// Lo que se decidió actualizar en el pedido con los datos de la OC
export function colAplicar(a = {}) {
  const c = {};
  if (a.cantidad) c.cantidad = a.cantidad;
  if (a.fechaCompromiso) c.fecha_compromiso = a.fechaCompromiso;
  if (a.monto) c.monto = a.monto;
  if (a.tallas) c.tallas = a.tallas;
  return c;
}
