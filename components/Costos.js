'use client';
import { useEffect, useState } from 'react';
import CostosPedidos from './CostosPedidos';
import Cotizaciones from './Cotizaciones';
import Materiales from './Materiales';
import Recetas from './Recetas';

const VISTAS = { pedidos: 'Costo por pedido', cotizaciones: 'Cotizaciones', materiales: 'Materiales', recetas: 'Recetas', parametros: 'Mano de obra e indirectos' };

export default function Costos(props) {
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('costos:vista') || 'pedidos'; } catch { return 'pedidos'; } });
  const ir = (v) => { setVista(v); try { localStorage.setItem('costos:vista', v); } catch {} };
  useEffect(() => { if (props.cotizarSol) setVista('cotizaciones'); }, [props.cotizarSol]);
  if (!props.K) return <div className="empty">Cargando costos…</div>;
  return (
    <>
      <div className="subnav" role="tablist" data-tour="costos-nav">
        {Object.entries(VISTAS).map(([k, v]) => <button key={k} className="chip" role="tab" aria-pressed={vista === k} onClick={() => ir(k)}>{v}</button>)}
      </div>
      {vista === 'pedidos' && <CostosPedidos {...props} />}
      {vista === 'cotizaciones' && <Cotizaciones {...props} />}
      {vista === 'materiales' && <Materiales {...props} />}
      {(vista === 'recetas' || vista === 'parametros') && <Recetas key={vista} {...props} vista={vista} />}
    </>
  );
}
