'use client';
import { useState } from 'react';
import { FASES, DOCS, TOTAL_PASOS, puedeMarcar, claveHito, claveHitoCot, ubicacion, OPCIONES_P15 as OPCION } from '@/lib/proceso';
import { revisarNovedades } from '@/lib/avisos';
import { TablaEquipo, useEquipo } from './EnviarOP';

const fh = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
const cuandoTxt = (d) => (d ? fh.format(new Date(d)).replace(/\./g, '') : '');

function Equipo({ o, ctx }) {
  const { equipo } = useEquipo(o, ctx);
  return <TablaEquipo equipo={equipo} />;
}

// Seguimiento de los 31 pasos del flujograma para un pedido
export default function Seguimiento({ o, S, supabase, perfil, docs = [], nombreDe, avisar, busy, setBusy, tour, onEnviarOP, ctx }) {
  const [abierto, setAbierto] = useState(false);
  const [verEquipo, setVerEquipo] = useState(false);
  const [marcando, setMarcando] = useState(null);
  const [nota, setNota] = useState('');
  const carpeta = docs.find((d) => d.tipo === 'carpeta');
  const docsDe = (p) => (p.doc || []).map((d) => ({ d, doc: docs.find((x) => x.clave === `doc:op:${o.id}:${d}`) })).filter((x) => x.doc);

  async function guardar(fn, ok) {
    if (busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return avisar('No se pudo guardar: ' + (error.message || 'revisa la conexión.'));
    if (ok) avisar(ok);
    revisarNovedades();
  }
  const fila = (p, n) => (p.nivel === 'cot'
    ? { clave: claveHitoCot(o.cotizacionId, p.k), cotizacion_id: o.cotizacionId, paso: p.k, nota: n, auto: false, por: perfil.id }
    : { clave: claveHito(o.id, p.k), orden_id: o.id, paso: p.k, nota: n, auto: false, por: perfil.id });
  const marcar = (p, n = nota.trim()) => guardar(() => supabase.from('hitos').insert(fila(p, n)), `${o.codigo}: paso ${p.n} "${p.nombre}" registrado.`).then(() => { setMarcando(null); setNota(''); });
  const quitar = (p) => guardar(() => supabase.from('hitos').delete().eq('clave', p.hito.clave), `${o.codigo}: se quitó el paso ${p.n}.`);
  const alternar = (p) => guardar(() => supabase.from('ordenes').update({ [p.col]: !o[p.campo] }).eq('id', o.id));

  const sig = S.siguiente;
  return (
    <div className="seg" data-tour={tour ? 'seguimiento' : undefined}>
      <div className="seg-barra">
        <ol className="fases" aria-label="Fases del flujograma">
          {FASES.map((f, i) => <li key={f} className={S.cerrado || i < S.fase ? 'hecha' : i === S.fase ? 'actual' : ''} title={f}><span>{f}</span></li>)}
        </ol>
        <div className="seg-sig">
          <span>
            {S.legado ? <><b>Entregado antes del seguimiento</b> · se considera cerrado</>
              : S.cerrado ? <><b>Pedido cerrado</b> · paso {TOTAL_PASOS} de {TOTAL_PASOS}</>
              : sig ? <>Flujograma: <b>paso {sig.n} de {TOTAL_PASOS}</b> · {sig.nombre} · <span className="muted">{sig.cargo}</span></> : null}
          </span>
          <span className="acts">
            {o.estado === 'espera' && onEnviarOP && <button className="btn sm primary" onClick={() => onEnviarOP(false)}>Enviar orden de producción</button>}
            {carpeta && carpeta.url && <a className="btn sm" href={carpeta.url} target="_blank" rel="noreferrer">Carpeta en Drive</a>}
            <button className="btn sm" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar trazabilidad' : `Trazabilidad ${S.hechos}/${S.aplican}`}</button>
          </span>
        </div>
      </div>

      {abierto && (
        <div className="pasos">
          <p className="small muted ubic">{ubicacion(S)}</p>
          {FASES.map((f, i) => {
            const ps = S.lista.filter((p) => p.fase === i);
            return (
              <section key={f}>
                <h4>{i + 1} · {f}</h4>
                <ul>
                  {ps.map((p) => {
                    const puede = puedeMarcar(p, perfil, o) && !(p.nivel === 'cot' && !o.cotizacionId);
                    const est = p.na ? 'na' : p.hecho ? 'hecho' : p.omitido ? 'omitido' : p.accionable ? 'toca' : 'pend';
                    const notaTxt = p.k === 'p15' ? OPCION[p.nota] || p.nota : p.nota;
                    return (
                      <li key={p.k} className={'paso ' + est + (sig && sig.k === p.k ? ' actual' : '')}>
                        <span className="ic" aria-hidden="true">{p.hecho ? '✓' : p.na || p.omitido ? '–' : p.n}</span>
                        <div className="tx">
                          <div><span className="num">{p.n}.</span> <b>{p.nombre}</b>{p.decision && <span className="dec-tag">decisión</span>} <span className="cargo">{p.cargo}</span></div>
                          <div className="small muted">
                            {p.na ? (p.conEstampado ? 'No aplica: sin estampado.' : p.siFalta ? 'No aplica: había material.' : p.k === 'p08' ? 'No aplica.' : 'No aplica: el pedido se creó sin cotización en la app.')
                              : p.hecho ? [cuandoTxt(p.cuando), p.por ? nombreDe(p.por) : p.hito && p.hito.auto ? 'automático' : '', notaTxt].filter(Boolean).join(' · ') || 'Cumplido'
                              : p.omitido ? 'No se marcó antes del cierre.'
                              : p.modo === 'auto' || p.modo === 'espejo' ? (p.como || 'Se cumple con el paso anterior.')
                              : 'Pendiente: se marca aquí cuando esté hecho.'}
                          </div>
                          {docsDe(p).map(({ d, doc }) => doc.estado === 'ok'
                            ? <a key={d} className="doc" href={doc.url} target="_blank" rel="noreferrer">{DOCS[d].nombre} en Drive</a>
                            : <span key={d} className="small muted" style={{ display: 'block' }}>{DOCS[d].nombre}: {doc.estado === 'error' ? 'no se pudo guardar en Drive, se reintenta sola' : 'guardando en Drive…'}</span>)}
                          {marcando === p.k && (
                            <form className="marcar" onSubmit={(e) => { e.preventDefault(); marcar(p); }}>
                              {p.nota && <input id={'nota-' + o.id + '-' + p.k} placeholder={p.nota} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />}
                              <button className="btn sm primary" type="submit" disabled={busy}>Confirmar</button>
                              <button className="btn sm" type="button" onClick={() => { setMarcando(null); setNota(''); }}>Cancelar</button>
                            </form>
                          )}
                        </div>
                        <div className="ac">
                          {p.k === 'p14' && !p.hecho && onEnviarOP && <button className="btn sm primary" onClick={() => onEnviarOP(false)}>Enviar OP</button>}
                          {p.k === 'p14' && p.hecho && onEnviarOP && <button className="btn sm" onClick={() => onEnviarOP(true)}>Reenviar</button>}
                          {p.modo === 'flag' && !p.na && puede && o.estado !== 'entregado' && <button className="btn sm" disabled={busy} onClick={() => alternar(p)}>{p.hecho ? 'Desmarcar' : 'Marcar'}</button>}
                          {p.modo === 'eleccion' && !p.hecho && puede && p.opciones.map(([v, l]) => <button key={v} className={'btn sm' + (p.accionable ? ' primary' : '')} disabled={busy} onClick={() => marcar(p, v)}>{l}</button>)}
                          {p.modo === 'manual' && !p.hecho && !p.na && puede && marcando !== p.k && <button className={'btn sm' + (p.accionable ? ' primary' : '')} disabled={busy} onClick={() => { setMarcando(p.k); setNota(''); }}>Marcar hecho</button>}
                          {['manual', 'eleccion'].includes(p.modo) && p.hecho && p.hito && !p.hito.auto && (perfil.rol === 'direccion' || p.hito.por === perfil.id) && <button className="btn sm link" disabled={busy} onClick={() => quitar(p)}>Quitar</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {ctx && !S.cerrado && (
            <section className="eq">
              <button className="btn sm" onClick={() => setVerEquipo(!verEquipo)}>{verEquipo ? 'Ocultar equipo sugerido' : 'Ver equipo sugerido (personas y máquinas)'}</button>
              {verEquipo && <div style={{ marginTop: 8 }}><Equipo o={o} ctx={ctx} /></div>}
            </section>
          )}
          <p className="small muted" style={{ margin: 0 }}>Los pasos automáticos se cumplen solos con lo que se registra en la app. Los documentos de cada paso importante se guardan en la carpeta del pedido en Google Drive.</p>
        </div>
      )}
    </div>
  );
}
