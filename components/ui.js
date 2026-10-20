'use client';
export function Pill({ M, o }) {
  if (o.estado === 'espera') return <span className="pill espera">Por activar · falta la OC</span>;
  const s = M.status[o.id];
  if (!s) return null;
  if (s.est === 'entregado') return <span className="pill gris">Entregado</span>;
  if (s.est === 'listo') return <span className="pill listo">Listo para despachar</span>;
  if (s.est === 'rojo') return <span className="pill rojo">{s.end === null ? 'Sin capacidad' : `Tarde ${Math.abs(s.slack)} día${Math.abs(s.slack) === 1 ? '' : 's'}`}</span>;
  if (s.est === 'amarillo') return <span className="pill amarillo">Justo · {s.slack} día{s.slack === 1 ? '' : 's'} de holgura</span>;
  return <span className="pill verde">A tiempo · {s.slack} días de holgura</span>;
}

export function decoTexto(d) {
  d = d || {};
  if (!d.tipo || d.tipo === 'ninguna') return 'Sin estampado';
  const ub = +d.ubicaciones || 1;
  const base = d.tipo === 'serigrafia' ? `Serigrafía ${d.colores || 1} color${(+d.colores || 1) > 1 ? 'es' : ''}`
    : d.tipo === 'bordado' ? `Bordado ${d.bordadoModo === 'externo' ? 'externo' : 'interno'}`
    : d.tipo === 'dtf' ? 'DTF' : d.tipo === 'vinil' ? 'Vinil' : d.tipo;
  return `${base} · ${ub} ubicación${ub > 1 ? 'es' : ''}`;
}
