'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOVEDADES } from '@/lib/novedades';

const CADA = 5 * 60 * 1000; // revisa cada 5 minutos y al volver a la app
const VERSION = process.env.APP_VERSION;

async function actualizar() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.update();
  } catch {}
  window.location.reload();
}

export default function Actualizacion({ bloqueado }) {
  const [nueva, setNueva] = useState(null);
  const [verNovedades, setVerNovedades] = useState(false);
  const [permiso, setPermiso] = useState('default');
  const avisado = useRef(false);
  const ultima = NOVEDADES[0];

  const revisar = useCallback(async () => {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.version && VERSION && j.version !== VERSION) {
        setNueva(j.novedad || {});
        // Aviso de escritorio si la app está en segundo plano y la persona lo activó
        if (!avisado.current && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          avisado.current = true;
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            const opts = { body: (j.novedad && j.novedad.titulo ? j.novedad.titulo + '. ' : '') + 'Abre la app y pulsa "Actualizar ahora".', icon: '/icons/icon-192.png', tag: 'actualizacion' };
            if (reg) reg.showNotification('Nueva versión del Taller Hawaiira', opts); else new Notification('Nueva versión del Taller Hawaiira', opts);
          } catch {}
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if ('Notification' in window) setPermiso(Notification.permission);
    const t = setInterval(revisar, CADA);
    const vis = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', revisar);
    const t0 = setTimeout(revisar, 15000);
    return () => { clearInterval(t); clearTimeout(t0); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', revisar); };
  }, [revisar]);

  // Después de actualizar: mostrar qué cambió (una sola vez por versión). La primera vez que alguien entra, no.
  useEffect(() => {
    if (!ultima) return;
    try {
      const vista = localStorage.getItem('novedad-vista');
      if (!vista) localStorage.setItem('novedad-vista', ultima.id);
      else if (vista !== ultima.id) setVerNovedades(true);
    } catch {}
  }, [ultima]);

  function cerrarNovedades() {
    setVerNovedades(false);
    try { localStorage.setItem('novedad-vista', ultima.id); } catch {}
  }
  async function activarAvisos() {
    try { const p = await Notification.requestPermission(); setPermiso(p); } catch {}
  }

  return (
    <>
      {nueva && (
        <div className="upd" role="alert">
          <div>
            <b>Hay una versión nueva de la app</b>
            {nueva.titulo && <div className="small">{nueva.titulo}</div>}
          </div>
          <div className="upd-acts">
            <button className="btn sm primary" onClick={actualizar}>Actualizar ahora</button>
            <button className="btn sm link" onClick={() => setNueva(null)}>Más tarde</button>
          </div>
        </div>
      )}
      {verNovedades && !bloqueado && ultima && (
        <div className="tour" role="dialog" aria-modal="true" aria-label="Novedades">
          <div className="tour-dim" onClick={cerrarNovedades} />
          <div className="tour-card" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="tour-step">Novedades · {ultima.fecha}</div>
            <h3>{ultima.titulo}</h3>
            <ul className="small" style={{ paddingLeft: 18, margin: '6px 0 12px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ultima.puntos.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <div className="tour-acts">
              {'Notification' in (typeof window !== 'undefined' ? window : {}) && permiso === 'default'
                ? <button className="btn sm" onClick={activarAvisos}>Avisarme en el escritorio</button>
                : <span className="small muted">{permiso === 'granted' ? 'Avisos de escritorio activados' : ''}</span>}
              <button className="btn sm primary" autoFocus onClick={cerrarNovedades}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
