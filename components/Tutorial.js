'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Recorrido guiado: oscurece la pantalla, resalta el elemento del paso y muestra una tarjeta con la explicación.
export default function Tutorial({ pasos, permitidas, setTab, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [card, setCard] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);
  const paso = pasos[i];

  const medir = useCallback(() => {
    const el = paso.sel ? document.querySelector(`[data-tour="${paso.sel}"]`) : null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: Math.min(r.height + pad * 2, window.innerHeight - 40) });
  }, [paso]);

  // Cambia de pestaña si hace falta, lleva el elemento a la vista y lo mide
  useEffect(() => {
    if (paso.tab && permitidas.includes(paso.tab)) setTab(paso.tab);
    const t1 = setTimeout(() => {
      const el = paso.sel ? document.querySelector(`[data-tour="${paso.sel}"]`) : null;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      setTimeout(medir, 60);
    }, 180);
    return () => clearTimeout(t1);
  }, [i, paso, permitidas, setTab, medir]);

  useEffect(() => {
    const on = () => medir();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [medir]);

  // Ubica la tarjeta debajo o encima del elemento, sin salirse de la pantalla
  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    const W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight, m = 12;
    if (!rect || W < 640) { setCard(W < 640 && rect ? { top: H - ch - m, left: (W - cw) / 2 } : { top: (H - ch) / 2, left: (W - cw) / 2 }); return; }
    const clampTop = (t) => Math.min(H - ch - m, Math.max(m, t));
    const clampLeft = (l) => Math.min(W - cw - m, Math.max(m, l));
    if (rect.top + rect.height + m + ch <= H - m) { setCard({ top: rect.top + rect.height + m, left: clampLeft(rect.left) }); return; } // debajo
    if (rect.top - ch - m >= m) { setCard({ top: rect.top - ch - m, left: clampLeft(rect.left) }); return; } // encima
    if (rect.left + rect.width + m + cw <= W - m) { setCard({ top: clampTop(rect.top), left: rect.left + rect.width + m }); return; } // a la derecha
    if (rect.left - cw - m >= m) { setCard({ top: clampTop(rect.top), left: rect.left - cw - m }); return; } // a la izquierda
    setCard({ top: H - ch - m, left: clampLeft(rect.left) }); // abajo de la pantalla
  }, [rect, i]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(pasos.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [pasos.length, onClose]);

  const ultimo = i === pasos.length - 1;
  const falta = paso.sel && !rect && i > 0;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tutorial">
      {rect ? <div className="tour-hole" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} /> : <div className="tour-dim" />}
      <div ref={cardRef} className="tour-card" style={{ top: card.top, left: card.left }}>
        <div className="tour-step">Paso {i + 1} de {pasos.length}</div>
        <h3>{paso.titulo}</h3>
        <p>{paso.texto}</p>
        {falta && <p className="small muted">Todavía no hay nada que mostrar aquí; aparecerá cuando haya pedidos cargados.</p>}
        <div className="tour-bar"><i style={{ width: ((i + 1) / pasos.length) * 100 + '%' }} /></div>
        <div className="tour-acts">
          <button className="btn link" onClick={onClose}>{ultimo ? '' : 'Saltar tutorial'}</button>
          <span style={{ display: 'flex', gap: 6 }}>
            {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>Anterior</button>}
            <button className="btn sm primary" autoFocus onClick={() => (ultimo ? onClose() : setI(i + 1))}>{ultimo ? 'Terminar' : 'Siguiente'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
