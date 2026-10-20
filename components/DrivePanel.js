'use client';
import { useCallback, useEffect, useState } from 'react';

const fh = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });

// Ajustes → Google Drive: conectar la cuenta del taller, ver la carpeta y la hoja de seguimiento, sincronizar
export default function DrivePanel({ perfil, avisar }) {
  const [e, setE] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progreso, setProgreso] = useState('');
  const esDir = perfil.rol === 'direccion';

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/drive', { cache: 'no-store' });
      setE(r.ok ? await r.json() : { error: (await r.json().catch(() => ({}))).error || 'No se pudo leer el estado.' });
    } catch { setE({ error: 'Sin conexión.' }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function sincronizar() {
    setBusy(true);
    let subidos = 0, filas = 0, vueltas = 0, ultimo = null;
    try {
      do {
        setProgreso(vueltas ? `Subiendo… ${subidos} documento${subidos === 1 ? '' : 's'} hasta ahora` : 'Revisando pedidos…');
        const r = await fetch('/api/drive', { method: 'POST' });
        ultimo = await r.json();
        if (!r.ok || !ultimo.ok) throw new Error(ultimo.error || 'No se pudo sincronizar.');
        const d = ultimo.drive || {};
        if (d.conectado === false) throw new Error(d.motivo || (d.errores || [])[0] || 'Google Drive no está conectado.');
        subidos += d.documentos || 0; filas += d.registros || 0; vueltas++;
        if (!d.pendientes) break;
      } while (vueltas < 15);
      const errs = (ultimo.drive && ultimo.drive.errores) || [];
      avisar(`Sincronizado: ${subidos} documento${subidos === 1 ? '' : 's'} y ${filas} paso${filas === 1 ? '' : 's'} anotados en la hoja.${errs.length ? ' Hubo errores: revisa abajo.' : ''}`);
    } catch (err) {
      avisar(err.message);
    }
    setBusy(false); setProgreso('');
    cargar();
  }
  async function desconectar() {
    setBusy(true);
    const r = await fetch('/api/drive', { method: 'DELETE' });
    setBusy(false);
    avisar(r.ok ? 'Google Drive desconectado. Los archivos que ya se subieron siguen en Drive.' : 'No se pudo desconectar.');
    cargar();
  }
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); avisar('Copiado.'); } catch { avisar('Selecciona el texto y cópialo.'); } };

  if (!e) return <div className="panel"><span className="small muted">Revisando la conexión con Google Drive…</span></div>;
  if (e.error) return <div className="panel"><span className="small" style={{ color: 'var(--bad)' }}>{e.error}</span></div>;

  return (
    <div className="panel drive" data-tour="drive">
      <p className="small muted" style={{ marginTop: 0 }}>
        En cada paso importante del pedido la app guarda el documento en Google Drive: cotización, orden de compra del cliente, orden de producción, nota de entrega e informe de cierre, cada uno en la carpeta del pedido. Además anota cada paso cumplido en la hoja <b>Seguimiento de pedidos</b> (pestañas Estado de pedidos y Bitácora).
      </p>
      {!e.configurado ? (
        <>
          <p style={{ margin: '0 0 6px' }}><span className="pill amarillo">Falta configurar</span> Agrega en Vercel las variables <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> y vuelve a desplegar (instructivo, paso 4.6).</p>
          <div className="small muted">Dirección de regreso que se registra en Google:</div>
          <div className="copiar"><code>{e.redirectUri}</code><button className="btn sm" onClick={() => copiar(e.redirectUri)}>Copiar</button></div>
        </>
      ) : !e.conectado ? (
        <>
          <p style={{ margin: '0 0 8px' }}><span className="pill gris">Sin conectar</span> Conecta la cuenta de Google del taller. Se abre Google para dar permiso: la app solo puede ver y modificar los archivos que ella misma crea.</p>
          {esDir ? <a className="btn primary" href="/api/drive/conectar">Conectar Google Drive</a> : <span className="small muted">Solo Dirección puede conectar la cuenta.</span>}
          <div className="small muted" style={{ marginTop: 10 }}>Dirección de regreso registrada en Google:</div>
          <div className="copiar"><code>{e.redirectUri}</code><button className="btn sm" onClick={() => copiar(e.redirectUri)}>Copiar</button></div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}><span className="pill verde">Conectado</span> {e.email ? <b>{e.email}</b> : 'Cuenta de Google del taller'}{e.ultimaSync ? <span className="small muted"> · última sincronización {fh.format(new Date(e.ultimaSync)).replace(/\./g, '')}</span> : null}</p>
          <div className="formacts" style={{ marginTop: 0 }}>
            {e.carpeta && <a className="btn" href={e.carpeta} target="_blank" rel="noreferrer">Abrir carpeta</a>}
            {e.hoja && <a className="btn" href={e.hoja} target="_blank" rel="noreferrer">Abrir hoja de seguimiento</a>}
            <button className="btn primary" onClick={sincronizar} disabled={busy}>{busy ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
            {esDir && <button className="btn link" onClick={desconectar} disabled={busy}>Desconectar</button>}
          </div>
          {progreso && <p className="small muted" style={{ margin: '6px 0 0' }}>{progreso}</p>}
          <p className="small muted" style={{ margin: '8px 0 0' }}>{e.documentos} documento{e.documentos === 1 ? '' : 's'} guardado{e.documentos === 1 ? '' : 's'}. La app sincroniza sola después de cada cambio y una vez al día; usa el botón para subir de una vez todo lo pendiente (por ejemplo, la primera vez).</p>
          {e.ultimoError && <p className="small" style={{ color: 'var(--bad)', margin: '8px 0 0' }}>Último error: {e.ultimoError}</p>}
          {e.conError && e.conError.length > 0 && (
            <details style={{ marginTop: 8 }}><summary className="small">Documentos con error ({e.conError.length})</summary>
              <ul className="small muted">{e.conError.map((d) => <li key={d.clave}>{d.clave} · {d.intentos} intento{d.intentos === 1 ? '' : 's'} · {d.error}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
