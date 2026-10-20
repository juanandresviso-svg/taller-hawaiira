'use client';
export default function Imprimir() {
  return (
    <div className="cot-barra">
      <button className="btn primary" onClick={() => window.print()}>Imprimir o guardar como PDF</button>
      <span className="small muted">En el diálogo de impresión elige "Guardar como PDF".</span>
    </div>
  );
}
