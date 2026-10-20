'use client';
import { useState } from 'react';
import { POR, usd, cfgCostos, crearCostos } from '@/lib/costos';
import { DECO_NAME, POOLS, POOL_NAME, nf1 } from '@/lib/motor';

// Recetas por producto, materiales del estampado, mano de obra, indirectos, margen y datos de la empresa.
export default function Recetas({ supabase, M, K, materiales, avisar, recargar, vista }) {
  const [c, setC] = useState(() => structuredClone(cfgCostos(K.C)));
  const [prod, setProd] = useState(Object.keys(M.cfg.productos)[0]);
  const [deco, setDeco] = useState('serigrafia');
  const [busy, setBusy] = useState(false);
  const activos = materiales.filter((m) => m.activo !== false);
  const sucio = JSON.stringify(c) !== JSON.stringify(cfgCostos(K.C));

  const set = (fn) => setC((d) => { const n = structuredClone(d); fn(n); return n; });
  async function guardar() {
    setBusy(true);
    const { error } = await supabase.from('costos_config').update({ data: c, actualizado: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (error) return avisar('No se pudo guardar: ' + error.message);
    avisar('Costos guardados.');
    recargar.costos();
  }

  // Costo por pieza con la configuración en edición (sin estampado), para ver el efecto antes de guardar
  const Kd = crearCostos({ M, cc: c, materiales });
  const muestra = Kd.presupuesto({ producto: prod, cantidad: 100, deco: { tipo: 'ninguna' } });
  const muestraDeco = Kd.presupuesto({ producto: prod, cantidad: 100, deco: { tipo: deco, colores: 1, ubicaciones: 1, bordadoModo: 'interno' } });

  function renderLineas(lineas, onChange, conPor) {
    return (
      <div className="scroll lineas">
        <table>
          <thead><tr><th>Material</th><th className="r">Consumo</th><th>Unidad</th>{conPor && <th>Se cuenta</th>}<th className="r">Merma %</th><th className="r">Costo</th><th></th></tr></thead>
          <tbody>
            {lineas.map((l, i) => {
              const m = materiales.find((x) => x.id === l.material);
              return (
                <tr key={i}>
                  <td><select aria-label="Material" value={l.material || ''} onChange={(e) => onChange((ls) => { ls[i].material = e.target.value; })}>
                    <option value="">Elegir…</option>{activos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></td>
                  <td className="r"><input aria-label="Consumo" type="number" step="0.001" min="0" value={l.consumo} onChange={(e) => onChange((ls) => { ls[i].consumo = e.target.value; })} /></td>
                  <td className="muted small">{m ? m.unidad : ''}</td>
                  {conPor && <td><select aria-label="Se cuenta" value={l.por || 'pieza'} onChange={(e) => onChange((ls) => { ls[i].por = e.target.value; })}>{Object.entries(POR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>}
                  <td className="r"><input aria-label="Merma" type="number" step="1" min="0" value={l.merma ?? ''} onChange={(e) => onChange((ls) => { ls[i].merma = e.target.value; })} /></td>
                  <td className="r small">{m ? usd.format((+l.consumo || 0) * (1 + (+l.merma || 0) / 100) * (+m.costo || 0)) : '—'}</td>
                  <td className="r"><button type="button" className="btn sm" onClick={() => onChange((ls) => { ls.splice(i, 1); })}>Quitar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="formacts" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm" onClick={() => onChange((ls) => { ls.push({ material: '', consumo: '', merma: 5, por: 'pieza' }); })}>Agregar material</button>
        </div>
      </div>
    );
  }

  const barra = (
    <div className="formacts" style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <button className="btn primary" onClick={guardar} disabled={busy || !sucio}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      <button className="btn" onClick={() => setC(structuredClone(cfgCostos(K.C)))} disabled={!sucio}>Descartar</button>
      {sucio && <span className="small" style={{ color: 'var(--warn)' }}>Hay cambios sin guardar</span>}
    </div>
  );

  if (vista === 'recetas') {
    return (
      <>
        <h2>Receta de cada producto (consumo por pieza)</h2>
        <div className="chips">{Object.entries(M.cfg.productos).map(([k, p]) => <button key={k} className="chip" aria-pressed={prod === k} onClick={() => setProd(k)}>{p.nombre}{(c.recetas[k] || []).length ? '' : ' · sin receta'}</button>)}</div>
        <div className="panel">
          {renderLineas(c.recetas[prod] || [], (fn) => set((n) => { n.recetas[prod] = n.recetas[prod] || []; fn(n.recetas[prod]); }), false)}
          <p className="small muted" style={{ marginBottom: 0 }}>Ejemplo: una franela usa 0,22 kg de tela, 1 etiqueta tejida, 1 etiqueta de talla, 1 bolsa y 0,02 conos de hilo. La merma suma el desperdicio de corte.</p>
          <p style={{ marginBottom: 0 }}>Costo por pieza de <b>{M.cfg.productos[prod]?.nombre}</b> sin estampado: materiales <b>{usd.format(muestra.lineas.reduce((a, l) => a + l.costo, 0) / 100)}</b> · mano de obra <b>{usd.format(muestra.manoObra / 100)}</b> · indirectos <b>{usd.format(muestra.indirectos / 100)}</b> · total <b>{usd.format(muestra.unitario)}</b></p>
        </div>

        <h2>Materiales del estampado</h2>
        <div className="chips">{['serigrafia', 'dtf', 'vinil', 'bordado'].map((k) => <button key={k} className="chip" aria-pressed={deco === k} onClick={() => setDeco(k)}>{DECO_NAME[k]}</button>)}</div>
        <div className="panel">
          {renderLineas(c.decoMateriales[deco] || [], (fn) => set((n) => { n.decoMateriales[deco] = n.decoMateriales[deco] || []; fn(n.decoMateriales[deco]); }), true)}
          <p className="small muted" style={{ marginBottom: 0 }}>"Se cuenta" indica cómo se multiplica: por pieza, por pieza y ubicación (DTF, vinil, bordado), por pieza, color y ubicación (tinta de serigrafía) o una vez por pedido (películas, ponchado).</p>
          <p style={{ marginBottom: 0 }}>Costo por pieza de {M.cfg.productos[prod]?.nombre} con {DECO_NAME[deco].toLowerCase()} (1 color, 1 ubicación, 100 piezas): <b>{usd.format(muestraDeco.unitario)}</b></p>
          {deco === 'bordado' && (
            <div className="fgrid" style={{ marginTop: 10 }}>
              <label className="f">Bordado externo: lo que cobra el aliado por pieza y ubicación (US$)
                <input id="b-ext" type="number" step="0.01" min="0" value={c.bordadoExterno.costoPieza} onChange={(e) => set((n) => { n.bordadoExterno.costoPieza = e.target.value; })} />
              </label>
            </div>
          )}
        </div>
        {barra}
      </>
    );
  }

  // Parámetros: mano de obra, indirectos, margen y empresa
  return (
    <>
      <h2>Mano de obra · costo por hora de cada estación (US$)</h2>
      <div className="panel">
        <div className="fgrid">
          {POOLS.map((p) => (
            <label key={p} className="f">{POOL_NAME[p]}
              <input id={'ch-' + p} type="number" step="0.01" min="0" value={c.costoHora[p]} onChange={(e) => set((n) => { n.costoHora[p] = e.target.value; })} />
            </label>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Promedio por persona de esa estación: sueldo + bonos + prestaciones del mes, dividido entre las horas trabajadas al mes. La app lo ajusta por la eficiencia real ({M.cfg.eficiencia}%): el minuto productivo de costura cuesta {usd.format(Kd.costoMin('costura'))}.</p>
      </div>

      <h2>Gastos indirectos y precios</h2>
      <div className="panel">
        <div className="fgrid">
          <label className="f">Gastos indirectos al mes (US$)<input id="ind" type="number" step="1" min="0" value={c.indirectosMes} onChange={(e) => set((n) => { n.indirectosMes = e.target.value; })} /></label>
          <label className="f">Margen objetivo sobre el precio (%)<input id="mar" type="number" step="1" min="0" max="90" value={c.margen} onChange={(e) => set((n) => { n.margen = e.target.value; })} /></label>
          <label className="f">Anticipo en cotizaciones (%)<input id="ant" type="number" step="5" min="0" max="100" value={c.anticipo} onChange={(e) => set((n) => { n.anticipo = e.target.value; })} /></label>
          <label className="f">Validez de cotizaciones (días)<input id="val" type="number" step="1" min="1" value={c.validezDias} onChange={(e) => set((n) => { n.validezDias = e.target.value; })} /></label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Indirectos: alquiler, luz, agua, internet, mantenimiento, sueldos administrativos, etc. Se reparten según los minutos de producción de cada pedido: hoy son {usd.format(Kd.indirectoMin * 60)} por hora productiva ({nf1.format(Kd.minMes / 60)} horas productivas al mes).</p>
      </div>

      <h2>Datos de la empresa para las cotizaciones</h2>
      <div className="panel">
        <div className="fgrid">
          {[['nombre', 'Razón social'], ['rif', 'RIF'], ['direccion', 'Dirección'], ['ciudad', 'Ciudad y país'], ['telefono', 'Teléfono / WhatsApp'], ['correo', 'Correo'], ['proximaCotizacion', 'Próximo n.º de cotización'], ['metodoPago', 'Método de pago por defecto'], ['observaciones', 'Observaciones por defecto'], ['leyendaIva', 'Leyenda de impuestos']].map(([k, l]) => (
            <label key={k} className="f">{l}<input id={'emp-' + k} value={c.empresa[k] || ''} onChange={(e) => set((n) => { n.empresa[k] = e.target.value; })} /></label>
          ))}
        </div>
      </div>
      {barra}
    </>
  );
}
