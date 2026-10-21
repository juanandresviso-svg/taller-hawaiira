'use client';
import { useEffect, useState } from 'react';

// Sección que se puede colapsar. Recuerda en este dispositivo si quedó abierta o cerrada.
// `resumen` se muestra junto al título cuando está cerrada (ej. "3 en rojo").
export default function Seccion({ id, titulo, resumen = null, abierta = true, children }) {
  const clave = 'seccion:' + id;
  const [open, setOpen] = useState(abierta);
  useEffect(() => {
    try { const v = localStorage.getItem(clave); if (v != null) setOpen(v === '1'); } catch {}
    if (typeof window !== 'undefined' && window.__tutorialAbierto) setOpen(true); // el tutorial necesita ver todo
    // "Abrir todo / Cerrar todo" y el tutorial abren o cierran todas las secciones
    const fn = (e) => { if (!e.detail || e.detail.grupo == null || e.detail.grupo === id.split(':')[0]) setOpen(!!(e.detail && e.detail.abrir)); };
    window.addEventListener('secciones', fn);
    return () => window.removeEventListener('secciones', fn);
  }, [clave, id]);
  useEffect(() => { try { localStorage.setItem(clave, open ? '1' : '0'); } catch {} }, [clave, open]);

  return (
    <section className={'sec' + (open ? ' abierta' : '')}>
      <h2 className="sec-h">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="sec-flecha" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span>{titulo}</span>
          {!open && resumen != null && resumen !== '' && <span className="sec-res">{resumen}</span>}
        </button>
      </h2>
      {open && <div className="sec-c">{children}</div>}
    </section>
  );
}

// Botones para abrir o cerrar todas las secciones de una pestaña
export function TodoSecciones({ grupo }) {
  const mandar = (abrir) => window.dispatchEvent(new CustomEvent('secciones', { detail: { abrir, grupo } }));
  return (
    <div className="sec-todo">
      <button type="button" className="btn sm link" onClick={() => mandar(false)}>Cerrar todo</button>
      <button type="button" className="btn sm link" onClick={() => mandar(true)}>Abrir todo</button>
    </div>
  );
}
