import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cfgCostos } from '@/lib/costos';
import Imprimir from './imprimir';

export const metadata = { title: 'Cotización · Hawaiira Studio' };

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const fecha = (s) => (s ? new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(s).slice(0, 10) + 'T12:00:00Z')) : '');
function deco(d) {
  d = d || {};
  if (!d.tipo || d.tipo === 'ninguna') return 'Sin estampado';
  const ub = +d.ubicaciones || 1;
  const t = d.tipo === 'serigrafia' ? `Serigrafía ${d.colores || 1} color${(+d.colores || 1) > 1 ? 'es' : ''}` : d.tipo === 'bordado' ? 'Bordado' : d.tipo === 'dtf' ? 'DTF' : 'Vinil';
  return `${t}, ${ub} ubicación${ub > 1 ? 'es' : ''}`;
}

export default async function Cotizacion({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, { data: cc }] = await Promise.all([
    supabase.from('cotizaciones').select('*').eq('id', id).single(),
    supabase.from('costos_config').select('data').eq('id', 1).single(),
  ]);
  if (!c) notFound();
  const emp = cfgCostos(cc?.data).empresa;
  const items = c.items || [];
  const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0);

  return (
    <main className="cot">
      <Imprimir />
      <article className="hoja">
        <header className="cot-h">
          <div>
            <img src="/logo.svg" alt={emp.nombre} className="cot-logo" />
            <div className="cot-emp">
              {emp.rif && <div>RIF {emp.rif}</div>}
              {emp.direccion && <div>{emp.direccion}</div>}
              {[emp.telefono, emp.correo].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="cot-num">
            <div className="cot-tit">Cotización</div>
            <div className="mono">{c.numero}</div>
            <div>{fecha(c.creado)}</div>
          </div>
        </header>
        <section className="cot-cli">
          <div><span>Cliente</span><b>{c.cliente}</b>{c.contacto && <div>{c.contacto}</div>}</div>
          <div><span>Válida hasta</span><b>{fecha(c.validez)}</b></div>
          {c.fecha_entrega && <div><span>Entrega estimada</span><b>{fecha(c.fecha_entrega)}</b></div>}
        </section>
        <table className="cot-t">
          <thead><tr><th>Descripción</th><th className="r">Cantidad</th><th className="r">Precio unitario</th><th className="r">Total</th></tr></thead>
          <tbody>
            {items.map((i, k) => (
              <tr key={k}>
                <td><b>{i.nombre}</b>{i.descripcion ? ` · ${i.descripcion}` : ''}<div className="cot-sub">{deco(i.deco)}{i.tallas ? ` · Tallas ${i.tallas}` : ''}</div></td>
                <td className="r">{new Intl.NumberFormat('es-VE').format(i.cantidad)}</td>
                <td className="r">{usd.format(i.precio)}</td>
                <td className="r">{usd.format(i.cantidad * i.precio)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} className="r">Total</td><td className="r"><b>{usd.format(total)}</b></td></tr></tfoot>
        </table>
        {c.notas && <section className="cot-notas"><span>Condiciones</span><p>{c.notas}</p></section>}
        <footer className="cot-pie">{emp.nombre} · Del Taller al Mundo</footer>
      </article>
    </main>
  );
}
