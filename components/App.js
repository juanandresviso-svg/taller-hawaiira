'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crearMotor, ordenDesdeDb, fd, isoWeek, isoDay, hoyCaracas, ROLES, POOL_NAME } from '@/lib/motor';
import Tablero from './Tablero';
import Pedidos from './Pedidos';
import MiTrabajo from './MiTrabajo';
import Ajustes from './Ajustes';
import Usuarios from './Usuarios';

const TABS = {
  tablero: 'Tablero',
  pedidos: 'Pedidos',
  taller: 'Mi trabajo',
  ajustes: 'Ajustes',
  usuarios: 'Usuarios',
};
function tabsPara(rol) {
  if (rol === 'operador') return ['taller'];
  if (rol === 'direccion') return ['tablero', 'pedidos', 'taller', 'ajustes', 'usuarios'];
  if (rol === 'jefa') return ['tablero', 'pedidos', 'taller', 'ajustes'];
  return ['tablero', 'pedidos', 'taller'];
}

export default function App({ perfil, cliente }) {
  const supabase = useMemo(() => cliente || createClient(), [cliente]);
  const permitidas = tabsPara(perfil.rol);
  const [tab, setTab] = useState(permitidas[0]);
  const [config, setConfig] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [historial, setHistorial] = useState({});
  const [live, setLive] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState(null);
  const toastT = useRef(null);

  const avisar = useCallback((msg, undo) => {
    clearTimeout(toastT.current);
    setToast({ msg, undo });
    toastT.current = setTimeout(() => setToast(null), undo ? 9000 : 4000);
  }, []);

  const cargar = useMemo(() => ({
    config: async () => { const { data } = await supabase.from('config').select('data').eq('id', 1).single(); setConfig(data?.data || null); },
    ordenes: async () => { const { data } = await supabase.from('ordenes').select('*').order('fecha_compromiso'); setOrdenes((data || []).map(ordenDesdeDb)); },
    perfiles: async () => { const { data } = await supabase.from('perfiles').select('*').order('nombre'); setPerfiles(data || []); },
    registros: async () => {
      const desde = new Date(hoyCaracas()); desde.setDate(desde.getDate() - 60);
      const { data } = await supabase.from('registros').select('*').gte('dia', isoDay(desde)).order('ts', { ascending: false }).limit(5000);
      setRegistros(data || []);
    },
    historial: async () => { const { data } = await supabase.from('historial').select('*'); setHistorial(Object.fromEntries((data || []).map((h) => [h.semana, h]))); },
  }), [supabase]);

  useEffect(() => {
    try { const t = localStorage.getItem('tab'); if (t && permitidas.includes(t)) setTab(t); } catch {}
    Promise.all(Object.values(cargar).map((f) => f())).finally(() => setCargando(false));
    const timers = {};
    const refrescar = (tabla) => { clearTimeout(timers[tabla]); timers[tabla] = setTimeout(() => cargar[tabla](), 250); };
    const canal = supabase.channel('taller')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => refrescar('ordenes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => refrescar('registros'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, () => refrescar('config'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => refrescar('perfiles'))
      .subscribe((s) => setLive(s === 'SUBSCRIBED'));
    // Al volver a la app después de un rato, refresca todo
    const vis = () => { if (document.visibilityState === 'visible') Object.values(cargar).forEach((f) => f()); };
    document.addEventListener('visibilitychange', vis);
    return () => { supabase.removeChannel(canal); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, cargar]);

  const M = useMemo(() => crearMotor({ config, ordenes, perfiles, historial }), [config, ordenes, perfiles, historial]);

  const cambiarTab = (t) => { setTab(t); try { localStorage.setItem('tab', t); } catch {} window.scrollTo(0, 0); };
  const ctx = { supabase, perfil, M, ordenes, perfiles, registros, config, avisar, recargar: cargar };

  return (
    <>
      <header className="top">
        <div className="row">
          <div className="brand">
            <img src="/logo.svg" alt="Hawaiira Studio" />
            <div className="sub"><b>Taller</b>{fd(M.t0)} · Semana {isoWeek(M.t0).slice(6)}</div>
          </div>
          <div className="userbox">
            <span><span className={'dot' + (live ? ' on' : '')} />{live ? 'En vivo' : 'Conectando…'}</span>
            <span><b>{perfil.nombre}</b> · {perfil.estacion ? POOL_NAME[perfil.estacion] : ROLES[perfil.rol]}</span>
            <form action="/api/salir" method="post"><button className="btn sm" type="submit">Salir</button></form>
          </div>
        </div>
        {permitidas.length > 1 && (
          <nav className="tabs" role="tablist">
            {permitidas.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => cambiarTab(t)}>{TABS[t]}</button>
            ))}
          </nav>
        )}
      </header>
      <main className="wrap">
        {!M.cfg.medidos && perfil.rol !== 'operador' && (
          <div className="banner warn">Los tiempos estándar son estimados iniciales. Mídelos en el taller y cárgalos en Ajustes para que las fechas y alertas sean exactas.</div>
        )}
        {cargando ? <div className="empty">Cargando el taller…</div> : (
          <>
            {tab === 'tablero' && <Tablero {...ctx} />}
            {tab === 'pedidos' && <Pedidos {...ctx} />}
            {tab === 'taller' && <MiTrabajo {...ctx} />}
            {tab === 'ajustes' && <Ajustes {...ctx} />}
            {tab === 'usuarios' && <Usuarios {...ctx} />}
          </>
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>Deshacer</button>}
        </div>
      )}
    </>
  );
}
