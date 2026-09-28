'use client';
export function Pill({ M, o }) {
  const s = M.status[o.id];
  if (!s) return null;
  if (s.est === 'entregado') return <span className="pill gris">Entregado</span>;
  if (s.est === 'listo') return <span className="pill listo">Listo para despachar</span>;
  if (s.est === 'rojo') return <span className="pill rojo">{s.end === null ? 'Sin capacidad' : `Tarde ${Math.abs(s.slack)} día${Math.abs(s.slack) === 1 ? '' : 's'}`}</span>;
  if (s.est === 'amarillo') return <span className="pill amarillo">Justo · {s.slack} día{s.slack === 1 ? '' : 's'} de holgura</span>;
  return <span className="pill verde">A tiempo · {s.slack} días de holgura</span>;
}
