'use client';
import { useState } from 'react';
import { FASES, DOCS, puedeMarcar, claveHito } from '@/lib/proceso';
import { revisarNovedades } from '@/lib/avisos';

const fh = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
const cuandoTxt = (d) => (d ? fh.format(new Date(d)).replace(/\./g, '') : '');

// Seguimiento del flujo de un pedido: barra de fases + lista de pasos con responsable, fecha y documento en Drive
export default function Seguimiento({ o, S, supabase, perfil, docs = [], nombreDe, avisar, busy, setBusy, tour }) {
  const [abierto, setAbierto] = useState(false);
  const [marcando, setMarcando] = useState(null); // paso manual que se está marcando
  const [nota, setNota] = useState('');
  const carpeta = docs.find((d) => d.tipo === 'carpeta');
  const docDe = (p) => (p.doc ? docs.find((d) => d.clave === `doc:op:${o.id}:${p.doc}`) : null);

  async function guardar(fn, ok) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return avisar('No se pudo guardar: ' + (error.message || 'revisa la conexión.'));
    if (ok) avisar(ok);
    revisarNovedades();
  }
  const marcar = (p) => guardar(() => supabase.from('hitos').insert({ clave: claveHito(o.id, p.k), orden_id: o.id, paso: p.k, nota: nota.trim(), auto: false, por: perfil.id }), `${o.codigo}: "${p.nombre}" registrado.`).then(() => { setMarcando(null); setNota(''); });
  const quitar = (p) => guardar(() => supabase.from('hitos').delete().eq('clave', claveHito(o.id, p.k)), `${o.codigo}: se quitó "${p.nombre}".`);
  const alternar = (p) => guardar(() => supabase.from('ordenes').update({ [p.col]: !o[p.campo] }).eq('id', o.id));

  const sig = S.siguiente;
  return (
    <div className="seg" data-tour={tour ? 'seguimiento' : undefined}>
      <div className="seg-barra">
        <ol className="fases" aria-label="Fases del pedido">
          {FASES.map((f, i) => {
            const est = S.cerrado || i < S.fase ? 'hecha' : i === S.fase ? 'actual' : '';
            return <li key={f} className={est} title={f}><span>{f}</span></li>;
          })}
        </ol>
        <div className="seg-sig">
          {S.legado ? <span><b>Entregado antes del seguimiento</b> · se considera cerrado</span>
            : S.cerrado ? <span><b>Pedido cerrado</b> · saldo cobrado</span>
            : sig ? <span>Próximo paso: <b>{sig.nombre}</b> · {sig.cargo}</span> : null}
          <span className="acts">
            {carpeta && carpeta.url && <a className="btn sm" href={carpeta.url} target="_blank" rel="noreferrer">Carpeta en Drive</a>}
            <button className="btn sm" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar seguimiento' : `Seguimiento ${S.hechos}/${S.aplican}`}</button>
          </span>
        </div>
      </div>

      {abierto && (
        <div className="pasos">
          {FASES.map((f, i) => {
            const ps = S.lista.filter((p) => p.fase === i);
            return (
              <section key={f}>
                <h4>{i + 1} · {f}</h4>
                <ul>
                  {ps.map((p) => {
                    const doc = docDe(p), puede = puedeMarcar(p, perfil.rol);
                    const est = p.na ? 'na' : p.hecho ? 'hecho' : p.omitido ? 'omitido' : p.accionable ? 'toca' : 'pend';
                    return (
                      <li key={p.k} className={'paso ' + est}>
                        <span className="ic" aria-hidden="true">{p.hecho ? '✓' : p.na || p.omitido ? '–' : '○'}</span>
                        <div className="tx">
                          <div><b>{p.nombre}</b> <span className="cargo">{p.cargo}</span></div>
                          <div className="small muted">
                            {p.na ? (p.k === 'arte' ? 'No aplica: el pedido no lleva estampado.' : 'No aplica: el pedido se creó sin cotización en la app.')
                              : p.hecho ? [cuandoTxt(p.cuando), p.por ? nombreDe(p.por) : p.hito && p.hito.auto ? 'automático' : '', p.nota].filter(Boolean).join(' · ') || 'Cumplido'
                              : p.omitido ? 'No se marcó antes del cierre.'
                              : p.modo === 'auto' ? p.como : 'Pendiente: se marca aquí cuando esté hecho.'}
                          </div>
                          {doc && (doc.estado === 'ok'
                            ? <a className="doc" href={doc.url} target="_blank" rel="noreferrer">{DOCS[p.doc].nombre} en Drive</a>
                            : <span className="small muted">{DOCS[p.doc].nombre}: {doc.estado === 'error' ? 'no se pudo guardar en Drive, se reintenta sola' : 'guardando en Drive…'}</span>)}
                          {marcando === p.k && (
                            <form className="marcar" onSubmit={(e) => { e.preventDefault(); marcar(p); }}>
                              {p.nota && <input id={'nota-' + o.id + '-' + p.k} placeholder={p.nota} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />}
                              <button className="btn sm primary" type="submit" disabled={busy}>Confirmar</button>
                              <button className="btn sm" type="button" onClick={() => { setMarcando(null); setNota(''); }}>Cancelar</button>
                            </form>
                          )}
                        </div>
                        <div className="ac">
                          {p.modo === 'flag' && !p.na && puede && o.estado !== 'entregado' && <button className="btn sm" disabled={busy} onClick={() => alternar(p)}>{p.hecho ? 'Desmarcar' : 'Marcar'}</button>}
                          {p.modo === 'manual' && !p.hecho && puede && marcando !== p.k && <button className={'btn sm' + (p.accionable ? ' primary' : '')} disabled={busy} onClick={() => { setMarcando(p.k); setNota(''); }}>Marcar hecho</button>}
                          {p.modo === 'manual' && p.hecho && p.hito && !p.hito.auto && (perfil.rol === 'direccion' || p.hito.por === perfil.id) && <button className="btn sm link" disabled={busy} onClick={() => quitar(p)}>Quitar</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="small muted" style={{ margin: 0 }}>Los pasos automáticos se cumplen solos con lo que se registra en la app. Los documentos de cada paso importante se guardan en la carpeta del pedido en Google Drive.</p>
        </div>
      )}
    </div>
  );
}
