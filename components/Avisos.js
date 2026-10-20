'use client';
import { useEffect, useState } from 'react';
import { TIPOS_AVISO, ROLES_AVISO } from '@/lib/avisos';

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function aBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
export function pushSoportado() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function suscripcionActual() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Guarda la suscripción de este dispositivo a nombre de la persona que tiene la sesión abierta
export async function vincularDispositivo(supabase, recibe) {
  if (!pushSoportado() || Notification.permission !== 'granted') return;
  try {
    const sub = await suscripcionActual();
    if (!sub) return;
    if (!recibe) { await supabase.rpc('quitar_suscripcion', { p_endpoint: sub.endpoint }); return; }
    const j = sub.toJSON();
    await supabase.rpc('guardar_suscripcion', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_agente: navigator.userAgent.slice(0, 200) });
  } catch {}
}

// Genera el par de claves VAPID en este navegador (no se envían a ningún lado) para pegarlas en Vercel
async function generarClaves() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const b64 = btoa(String.fromCharCode(...pub)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: b64, privada: jwk.d };
}
function GenerarClaves() {
  const [k, setK] = useState(null);
  const fila = (n, v) => (
    <div style={{ marginTop: 8 }}>
      <div className="small"><b>{n}</b></div>
      <div style={{ display: 'flex', gap: 6 }}><input readOnly value={v} onFocus={(e) => e.target.select()} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12 }} /><button className="btn sm" type="button" onClick={() => navigator.clipboard && navigator.clipboard.writeText(v)}>Copiar</button></div>
    </div>
  );
  return (
    <div className="subcard" style={{ marginTop: 10 }}>
      <b className="small">Falta configurar las notificaciones (solo una vez)</b>
      <p className="small muted">Genera las claves aquí, cópialas en Vercel → Settings → Environment Variables y vuelve a desplegar (Redeploy). Detalle en el paso 4.5 del instructivo.</p>
      {k ? <>{fila('NEXT_PUBLIC_VAPID_PUBLIC_KEY', k.publica)}{fila('VAPID_PRIVATE_KEY', k.privada)}<p className="small" style={{ color: 'var(--warn)', marginBottom: 0 }}>Copia las dos antes de cerrar este panel: no se guardan en ningún lado. La privada no se comparte con nadie.</p></>
        : <button className="btn sm primary" type="button" onClick={async () => setK(await generarClaves())}>Generar claves</button>}
    </div>
  );
}

const recibeTipo = (rol, t) => rol === 'direccion' || ROLES_AVISO[t].includes(rol) || ['pedidos', 'produccion', 'alertas'].includes(t);

export default function Avisos({ supabase, perfil, avisar, onClose }) {
  const [permiso, setPermiso] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [activo, setActivo] = useState(false);
  const [apagados, setApagados] = useState([]);
  const [busy, setBusy] = useState(false);
  const soportado = pushSoportado();
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent);
  const instalada = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    if (soportado) suscripcionActual().then((s) => setActivo(!!s && Notification.permission === 'granted')).catch(() => {});
    supabase.from('avisos_pref').select('apagados').eq('perfil_id', perfil.id).maybeSingle().then(({ data }) => setApagados((data && data.apagados) || []));
  }, [supabase, perfil.id, soportado]);

  async function activar() {
    if (!CLAVE) return avisar('Falta configurar las claves de notificaciones en Vercel. Avísale a Dirección (paso 12 del instructivo).');
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPermiso(p);
      if (p !== 'granted') { setBusy(false); return avisar('No se dio permiso para notificaciones en este navegador.'); }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE) });
      const j = sub.toJSON();
      const { error } = await supabase.rpc('guardar_suscripcion', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_agente: navigator.userAgent.slice(0, 200) });
      if (error) throw error;
      setActivo(true);
      avisar('Notificaciones activadas en este dispositivo.');
    } catch (e) {
      avisar('No se pudieron activar: ' + (e.message || e));
    }
    setBusy(false);
  }
  async function desactivar() {
    setBusy(true);
    try {
      const sub = await suscripcionActual();
      if (sub) { await supabase.rpc('quitar_suscripcion', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setActivo(false);
      avisar('Notificaciones desactivadas en este dispositivo.');
    } catch (e) { avisar('No se pudo desactivar: ' + (e.message || e)); }
    setBusy(false);
  }
  async function probar() {
    setBusy(true);
    const r = await fetch('/api/push-prueba', { method: 'POST' }).then((x) => x.json()).catch(() => ({ error: 'Sin conexión.' }));
    setBusy(false);
    avisar(r.ok ? 'Prueba enviada: debería aparecer en unos segundos.' : 'No se pudo enviar la prueba: ' + (r.error || ''));
  }
  async function cambiar(t, on) {
    const nuevos = on ? apagados.filter((x) => x !== t) : [...new Set([...apagados, t])];
    setApagados(nuevos);
    const { error } = await supabase.from('avisos_pref').upsert({ perfil_id: perfil.id, apagados: nuevos, actualizado: new Date().toISOString() });
    if (error) avisar('No se pudo guardar: ' + error.message);
  }

  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="avisos-t" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3 id="avisos-t" style={{ marginTop: 0 }}>Notificaciones</h3>
        <p className="small muted">Te avisan de las novedades del taller aunque la app esté cerrada. Se activan en cada dispositivo por separado (computadora, teléfono).</p>

        <div className="subcard">
          {!soportado ? (
            <p className="small" style={{ margin: 0 }}>Este navegador no permite notificaciones.{ios ? ' En iPhone: abre la app en Safari, toca Compartir → "Agregar a inicio", ábrela desde el ícono y activa aquí.' : ' Usa Chrome o Edge.'}</p>
          ) : permiso === 'denied' ? (
            <p className="small" style={{ margin: 0 }}>Las notificaciones están bloqueadas para esta página. Toca el candado junto a la dirección → Notificaciones → Permitir, y vuelve a abrir este panel.</p>
          ) : (
            <div className="formacts" style={{ marginTop: 0 }}>
              <b className="small">{activo ? '✓ Activadas en este dispositivo' : 'Desactivadas en este dispositivo'}</b>
              {activo
                ? <><button className="btn sm" disabled={busy} onClick={probar}>Enviar prueba</button><button className="btn sm" disabled={busy} onClick={desactivar}>Desactivar aquí</button></>
                : <button className="btn sm primary" disabled={busy} onClick={activar}>Activar en este dispositivo</button>}
            </div>
          )}
          {!CLAVE && perfil.rol === 'direccion' && <GenerarClaves />}
          {soportado && ios && !instalada && <p className="small muted" style={{ marginBottom: 0 }}>En iPhone solo funcionan con la app agregada a la pantalla de inicio.</p>}
        </div>

        <h4 style={{ margin: '16px 0 6px' }}>Qué quieres recibir</h4>
        <div className="checks" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          {Object.entries(TIPOS_AVISO).filter(([t]) => recibeTipo(perfil.rol, t)).map(([t, d]) => (
            <label key={t} style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!apagados.includes(t)} onChange={(e) => cambiar(t, e.target.checked)} />
              <span><b>{d.nombre}</b><br /><span className="small muted">{d.detalle}</span></span>
            </label>
          ))}
        </div>
        <p className="small muted">{perfil.rol === 'direccion' ? 'Dirección recibe las novedades de todo el taller.' : 'Recibes lo de tus pedidos y lo de tu área.'} Nunca te llega un aviso de algo que hiciste tú.</p>
        <div className="formacts"><button className="btn primary" onClick={onClose}>Listo</button></div>
      </div>
    </div>
  );
}
