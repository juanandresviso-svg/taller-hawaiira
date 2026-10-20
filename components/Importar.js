'use client';
import { useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import { interpretar, leerCSV } from '@/lib/importar';
import { ordenADb, fd, parseDay, nf, PROD_ETAPAS } from '@/lib/motor';

function siguiente(ordenes, extra = []) {
  let m = 0;
  [...ordenes.map((o) => o.codigo), ...extra].forEach((c) => { const n = parseInt(String(c || '').replace(/\D/g, ''), 10); if (n > m) m = n; });
  return m;
}

export default function Importar({ supabase, perfil, M, ordenes, perfiles, avisar, onClose }) {
  const [res, setRes] = useState(null);
  const [nombre, setNombre] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function leer(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr(''); setRes(null); setNombre(file.name);
    try {
      let filas;
      if (/\.csv$/i.test(file.name)) filas = leerCSV(await file.text());
      else {
        try { filas = await readSheet(file, 'Pedidos'); } catch { filas = await readSheet(file); }
      }
      const r = interpretar(filas, { M, perfiles, ordenes });
      if (r.faltan.length) setErr(r.faltan.join(' '));
      else if (!r.filas.length) setErr('El archivo no tiene pedidos. Llena la hoja "Pedidos" desde la fila 2 (las filas que empiezan con EJEMPLO se ignoran).');
      setRes(r);
    } catch {
      setErr('No pude leer el archivo. Guárdalo como Excel (.xlsx) o CSV y vuelve a intentarlo.');
    }
    e.target.value = '';
  }

  const validas = res ? res.filas.filter((f) => !f.errores.length) : [];
  const conError = res ? res.filas.filter((f) => f.errores.length) : [];

  async function importar() {
    if (!validas.length || busy) return;
    setBusy(true);
    let n = siguiente(ordenes, validas.map((f) => f.orden.codigo));
    const filas = validas.map(({ orden }) => {
      const codigo = orden.codigo || 'OP-' + String(++n).padStart(4, '0');
      return { ...ordenADb({ ...orden, codigo }), prog: orden.prog, ultimo: orden.ultimo, creado_por: perfil.id };
    });
    const { error } = await supabase.from('ordenes').insert(filas);
    setBusy(false);
    if (error) { setErr('No se pudo importar: ' + error.message); return; }
    avisar(`Se importaron ${filas.length} pedido${filas.length === 1 ? '' : 's'}.`);
    onClose(true);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }} data-tour="importar-panel">
      <h3 style={{ marginBottom: 6 }}>Importar pedidos desde Excel</h3>
      <ol className="small muted" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        <li><a href="/plantilla-pedidos.xlsx" download style={{ color: 'var(--ink)', fontWeight: 600 }}>Descarga la plantilla</a> y llena una fila por pedido en la hoja "Pedidos".</li>
        <li>Si el pedido ya está avanzado, escribe cuántas piezas van cortadas, cosidas, etc. Así la app calcula bien las fechas.</li>
        <li>Sube el archivo aquí, revisa la vista previa y pulsa Importar.</li>
      </ol>
      <div className="formacts" style={{ marginTop: 6 }}>
        <label className="btn primary" style={{ cursor: 'pointer' }}>
          Elegir archivo…
          <input type="file" accept=".xlsx,.csv" onChange={leer} hidden />
        </label>
        {nombre && <span className="small muted">{nombre}</span>}
        <button className="btn" type="button" onClick={() => onClose(false)}>Cerrar</button>
      </div>
      {err && <div className="err" role="alert">{err}</div>}

      {res && res.filas.length > 0 && (
        <>
          <p className="small" style={{ margin: '14px 0 8px' }}>
            <b>{validas.length}</b> pedido{validas.length === 1 ? '' : 's'} listo{validas.length === 1 ? '' : 's'} para importar
            {conError.length > 0 && <> · <span style={{ color: 'var(--bad)' }}><b>{conError.length}</b> con errores (no se importarán; corrígelos en el Excel y vuelve a subirlo)</span></>}
          </p>
          <div className="scroll" style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
            <table>
              <thead><tr><th>Fila</th><th>Cliente</th><th>Producto</th><th className="r">Cant.</th><th>Entrega</th><th>Avance</th><th>Revisión</th></tr></thead>
              <tbody>
                {res.filas.map((f) => {
                  const o = f.orden;
                  const av = Object.entries(o.prog).filter(([s]) => s !== 'preprensa').map(([s, v]) => `${PROD_ETAPAS[s]} ${nf.format(v)}`).join(' · ');
                  return (
                    <tr key={f.n} style={f.errores.length ? { background: 'var(--bad-soft)' } : undefined}>
                      <td className="muted">{f.n}</td>
                      <td>{o.cliente || '—'}</td>
                      <td>{o.producto ? M.prod(o).nombre : '—'}</td>
                      <td className="r">{o.cantidad > 0 ? nf.format(o.cantidad) : '—'}</td>
                      <td>{o.fechaCompromiso ? fd(parseDay(o.fechaCompromiso)) : '—'}</td>
                      <td className="small">{av || (o.prog.preprensa ? 'Preprensa lista' : 'Sin empezar')}</td>
                      <td className="small">
                        {f.errores.length ? <span style={{ color: 'var(--bad)' }}>{f.errores.join('. ')}</span> : <span style={{ color: 'var(--ok)' }}>OK</span>}
                        {f.avisos.length > 0 && <div style={{ color: 'var(--warn)' }}>{f.avisos.join('. ')}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="formacts">
            <button className="btn primary" disabled={!validas.length || busy} onClick={importar}>
              {busy ? 'Importando…' : `Importar ${validas.length} pedido${validas.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
