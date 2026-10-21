'use client';
export default function Imprimir({ nombre }) {
  return (
    <div className="cot-barra">
      <button className="btn primary" onClick={() => window.print()}>Descargar PDF</button>
      <span className="small muted">En el diálogo elige "Guardar como PDF". El archivo se llama «{nombre}».</span>
    </div>
  );
}
