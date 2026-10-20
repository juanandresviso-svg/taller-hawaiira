import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { crearMotor, ordenDesdeDb, STAGE_NAME, POOL_NAME, STAGE_POOL, parseDay, isoDay } from '@/lib/motor';
import { aprender, CAMPOS_DECO } from '@/lib/aprendizaje';
import { crearCostos } from '@/lib/costos';
import Imprimir from './imprimir';

export const metadata = { title: 'Informe de producción · Hawaiira Studio' };
export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const fFecha = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
const fHora = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
const fecha = (d) => (d ? fFecha.format(new Date(d)) : '—');
const pctTxt = (v) => (v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : '') + nf.format(v * 100) + '%');
function decoTxt(d) {
  d = d || {};
  if (!d.tipo || d.tipo === 'ninguna') return 'Sin estampado';
  const ub = +d.ubicaciones || 1;
  const t = d.tipo === 'serigrafia' ? `Serigrafía ${d.colores || 1} color${(+d.colores || 1) > 1 ? 'es' : ''}` : d.tipo === 'bordado' ? `Bordado ${d.bordadoModo === 'externo' ? 'externo' : 'interno'}` : d.tipo === 'dtf' ? 'DTF' : 'Vinil';
  return `${t} · ${ub} ubicación${ub > 1 ? 'es' : ''}`;
}
const diasHabiles = (a, b) => { let n = 0; const d = new Date(a); d.setHours(12); const fin = new Date(b); fin.setHours(12); while (d < fin) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n++; } return n; };

export default async function Informe({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row }, { data: regs }, { data: perfiles }, { data: cfg }, { data: tiempos }] = await Promise.all([
    supabase.from('ordenes').select('*').eq('id', id).single(),
    supabase.from('registros').select('*').eq('orden_id', id).order('ts'),
    supabase.from('perfiles').select('id, nombre, estacion'),
    supabase.from('config').select('data').eq('id', 1).single(),
    supabase.from('v_tiempos').select('*'),
  ]);
  if (!row) notFound();
  const o = ordenDesdeDb(row);
  // Tiempos planificados con lo aprendido ANTES de este pedido (sin contarlo a él mismo)
  const A = aprender(cfg?.data, (tiempos || []).filter((t) => t.orden_id !== o.id));
  const M = crearMotor({ config: A.efectivo, ordenes: [o], perfiles: perfiles || [] });
  const nombre = (pid) => (perfiles || []).find((p) => p.id === pid)?.nombre || '—';
  const R = regs || [];

  // Costos, solo si la persona tiene acceso
  const [{ data: cc }, { data: mats }, { data: cons }, { data: extras }] = await Promise.all([
    supabase.from('costos_config').select('data').eq('id', 1).maybeSingle(),
    supabase.from('materiales').select('*'),
    supabase.from('consumos').select('*').eq('orden_id', id),
    supabase.from('costos_pedido').select('*').eq('orden_id', id),
  ]);
  const K = cc ? crearCostos({ M, cc: cc.data, materiales: mats || [] }) : null;

  // Promedio de producciones anteriores del mismo producto (min por pieza), por etapa
  const anteriores = (s) => {
    const campo = Object.entries(CAMPOS_DECO).find(([, d]) => d.etapa === s);
    const filas = (tiempos || []).filter((t) => t.orden_id !== o.id && t.estado === 'entregado' && t.etapa === s && +t.minutos > 0 && +t.piezas_med >= 10);
    let lista;
    if (['corte', 'costura', 'empaque'].includes(s)) lista = filas.filter((t) => t.producto === o.producto).map((t) => ({ v: t.minutos / t.piezas_med, p: +t.piezas_med }));
    else if (campo) { const u = campo[1].unidades(o.deco || {}); lista = filas.filter((t) => campo[1].tipo.includes((t.deco || {}).tipo)).map((t) => ({ v: (t.minutos / (t.piezas_med * campo[1].unidades(t.deco || {}))) * u, p: +t.piezas_med })); }
    else return null;
    const peso = lista.reduce((a, x) => a + x.p, 0);
    return peso ? { v: lista.reduce((a, x) => a + x.v * x.p, 0) / peso, n: lista.length } : null;
  };

  const etapas = M.ruta(o).map((s) => {
    const rs = R.filter((r) => r.etapa === s);
    const piezas = rs.reduce((a, r) => a + r.cantidad, 0);
    const med = rs.filter((r) => r.minutos != null);
    const minutos = med.reduce((a, r) => a + +r.minutos, 0);
    const piezasMed = med.reduce((a, r) => a + r.cantidad, 0);
    const real = piezasMed ? minutos / piezasMed : null;
    const plan = M.mpp(o, s);
    const ant = anteriores(s);
    return {
      s, externo: M.externo(o, s), piezas, avance: M.doneOf(o, s) / M.tot(o, s), minutos, piezasMed, real, plan, ant,
      personas: [...new Set(rs.map((r) => r.persona_id))].map(nombre),
      desde: rs.length ? rs.reduce((a, r) => (r.inicio && r.inicio < a ? r.inicio : a), rs[0].inicio || rs[0].ts) : null,
      hasta: rs.length ? rs[rs.length - 1].ts : null,
    };
  });
  const horasReal = etapas.reduce((a, e) => a + e.minutos, 0) / 60;
  const horasPlanMed = etapas.reduce((a, e) => a + (e.real != null ? e.plan * e.piezasMed : 0), 0) / 60;
  const eficiencia = horasReal > 0 ? horasPlanMed / horasReal : null;
  const cobertura = R.length ? R.filter((r) => r.minutos != null).reduce((a, r) => a + r.cantidad, 0) / R.reduce((a, r) => a + r.cantidad, 0) : 0;
  const ini = R.length ? R[0].inicio || R[0].ts : null;
  const fin = o.estado === 'entregado' ? o.entregado : R.length ? R[R.length - 1].ts : null;
  const comp = parseDay(o.fechaCompromiso);
  const atraso = o.estado === 'entregado' && o.entregado ? (isoDay(new Date(o.entregado)) > o.fechaCompromiso ? diasHabiles(comp, new Date(o.entregado)) : 0) : null;
  const porPersona = Object.values(R.reduce((acc, r) => { const k = r.persona_id; acc[k] = acc[k] || { nombre: nombre(k), etapas: new Set(), piezas: 0, min: 0 }; acc[k].etapas.add(STAGE_NAME[r.etapa]); acc[k].piezas += r.cantidad; acc[k].min += +r.minutos || 0; return acc; }, {})).sort((a, b) => b.piezas - a.piezas);
  const pres = K ? K.presupuesto(o) : null, real = K ? K.real(o, cons || [], extras || []) : null;

  return (
    <main className="cot">
      <Imprimir />
      <article className="hoja">
        <header className="cot-h">
          <div><img src="/logo.svg" alt="Hawaiira Studio" className="cot-logo" /><div className="cot-emp">Informe de producción</div></div>
          <div className="cot-num"><div className="cot-tit">{o.codigo}</div><div>{o.cliente}</div><div>Generado {fecha(new Date())}</div></div>
        </header>

        <section className="cot-cli">
          <div><span>Producto</span><b>{M.prod(o).nombre} × {nf.format(o.cantidad)}</b><div>{decoTxt(o.deco)}{o.tallas ? ` · ${o.tallas}` : ''}</div></div>
          <div><span>Estado</span><b>{o.estado === 'entregado' ? 'Entregado' : 'En producción'}</b><div>{o.estado === 'entregado' ? (atraso ? `${atraso} día${atraso > 1 ? 's' : ''} hábil${atraso > 1 ? 'es' : ''} tarde` : 'A tiempo') : ''}</div></div>
          <div><span>Eficiencia</span><b>{eficiencia ? nf.format(eficiencia * 100) + '%' : '—'}</b><div className="small">estándar ÷ real</div></div>
        </section>

        <table className="cot-t">
          <tbody>
            <tr><td>Pedido creado</td><td className="r">{fecha(o.creado)}</td><td>Fecha comprometida</td><td className="r">{fecha(comp)}</td></tr>
            <tr><td>Inicio de producción</td><td className="r">{fecha(ini)}</td><td>{o.estado === 'entregado' ? 'Entregado' : 'Último registro'}</td><td className="r">{fecha(fin)}</td></tr>
            <tr><td>Horas-persona reales</td><td className="r">{nf1.format(horasReal)} h</td><td>Duración</td><td className="r">{ini && fin ? `${diasHabiles(new Date(ini), new Date(fin)) + 1} días hábiles` : '—'}</td></tr>
          </tbody>
        </table>

        <h3 className="inf-h">Tiempos por etapa (minutos por pieza)</h3>
        <table className="cot-t">
          <thead><tr><th>Etapa</th><th className="r">Piezas</th><th className="r">Real</th><th className="r">Planificado</th><th className="r">Pedidos anteriores</th><th className="r">vs. anteriores</th><th>Quién · cuándo</th></tr></thead>
          <tbody>
            {etapas.map((e) => (
              <tr key={e.s}>
                <td><b>{STAGE_NAME[e.s]}</b>{e.externo ? <div className="cot-sub">Taller aliado</div> : <div className="cot-sub">{POOL_NAME[STAGE_POOL[e.s]]}</div>}</td>
                <td className="r">{e.s === 'preprensa' ? (e.avance >= 1 ? 'Lista' : '—') : `${nf.format(e.piezas)} / ${nf.format(o.cantidad)}`}</td>
                <td className="r">{e.externo ? '—' : e.real != null ? <b>{nf2.format(e.real)}</b> : 'sin medir'}{e.s === 'preprensa' && e.real != null ? <div className="cot-sub">min en total</div> : null}</td>
                <td className="r">{e.externo ? '—' : nf2.format(e.plan)}</td>
                <td className="r">{e.ant ? <>{nf2.format(e.ant.v)}<div className="cot-sub">{e.ant.n} pedido{e.ant.n > 1 ? 's' : ''}</div></> : '—'}</td>
                <td className="r" style={{ color: e.real != null && e.ant ? (e.real > e.ant.v * 1.1 ? 'var(--bad)' : e.real < e.ant.v * 0.9 ? 'var(--ok)' : 'inherit') : 'inherit' }}>{e.real != null && e.ant ? pctTxt(e.real / e.ant.v - 1) : '—'}</td>
                <td className="small">{e.personas.join(', ') || '—'}<div className="cot-sub">{e.desde ? `${fHora.format(new Date(e.desde))} → ${fHora.format(new Date(e.hasta))}` : ''}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cot-sub" style={{ marginTop: 8 }}>
          Real = minutos-persona medidos ÷ piezas. Planificado = el tiempo que la app estimaba con las producciones anteriores, sin contar este pedido. En verde, más rápido que las producciones anteriores; en rojo, más de 10% más lento.
          Tiempo medido en el {nf.format(cobertura * 100)}% de las piezas registradas.
        </p>

        {porPersona.length > 0 && (
          <>
            <h3 className="inf-h">Quién produjo</h3>
            <table className="cot-t">
              <thead><tr><th>Persona</th><th>Etapas</th><th className="r">Piezas</th><th className="r">Horas medidas</th></tr></thead>
              <tbody>{porPersona.map((p, i) => <tr key={i}><td>{p.nombre}</td><td className="small">{[...p.etapas].join(', ')}</td><td className="r">{nf.format(p.piezas)}</td><td className="r">{nf1.format(p.min / 60)}</td></tr>)}</tbody>
            </table>
          </>
        )}

        {pres && real && (
          <>
            <h3 className="inf-h">Costos</h3>
            <table className="cot-t">
              <thead><tr><th></th><th className="r">Presupuesto</th><th className="r">Real a la fecha</th></tr></thead>
              <tbody>
                <tr><td>Materiales</td><td className="r">{usd.format(pres.materiales)}</td><td className="r">{usd.format(real.materiales)}</td></tr>
                <tr><td>Mano de obra</td><td className="r">{usd.format(pres.manoObra)}</td><td className="r">{usd.format(real.manoObra)}</td></tr>
                {pres.externo > 0 && <tr><td>Bordado externo</td><td className="r">{usd.format(pres.externo)}</td><td className="r">{usd.format(real.externo)}</td></tr>}
                <tr><td>Indirectos</td><td className="r">{usd.format(pres.indirectos)}</td><td className="r">{usd.format(real.indirectos)}</td></tr>
                {real.adicionales.map((x) => <tr key={x.id}><td>{x.concepto}</td><td className="r">—</td><td className="r">{usd.format(+x.monto || 0)}</td></tr>)}
              </tbody>
              <tfoot><tr><td>Total</td><td className="r"><b>{usd.format(pres.total)}</b></td><td className="r"><b>{usd.format(real.total)}</b></td></tr></tfoot>
            </table>
            {o.monto ? <p className="cot-sub" style={{ marginTop: 8 }}>Venta: {usd.format(o.monto)} · Margen con costo presupuestado: {nf.format(((o.monto - pres.total) / o.monto) * 100)}%{o.estado === 'entregado' ? ` · Margen real: ${nf.format(((o.monto - real.total) / o.monto) * 100)}%` : ''}</p> : null}
          </>
        )}
        <footer className="cot-pie">Hawaiira Studio · Del Taller al Mundo</footer>
      </article>
    </main>
  );
}
