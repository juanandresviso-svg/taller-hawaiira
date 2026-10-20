'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crearMotor, ordenDesdeDb, fd, isoWeek, isoDay, hoyCaracas, ROLES, POOL_NAME } from '@/lib/motor';
import Tablero from './Tablero';
import Pedidos from './Pedidos';
import MiTrabajo from './MiTrabajo';
import Ajustes from './Ajustes';
import Usuarios from './Usuarios';
import Tutorial from './Tutorial';
import Actualizacion from './Actualizacion';
import Avisos, { vincularDispositivo, pushSoportado } from './Avisos';
import { revisarNovedades, RECIBE_AVISOS } from '@/lib/avisos';
import { pasosTutorial } from '@/lib/tutorial';
import { aprender } from '@/lib/aprendizaje';
import Costos from './Costos';
import Materiales from './Materiales';
import { crearCostos, COSTO_ROLES, MATERIAL_ROLES } from '@/lib/costos';

const TABS = {
  tablero: 'Tablero',
  pedidos: 'Pedidos',
  taller: 'Mi trabajo',
  costos: 'Costos',
  materiales: 'Materiales',
  ajustes: 'Ajustes',
  usuarios: 'Usuarios',
};
const DRIVE_MSJ = {
  ok: 'Google Drive conectado. Los documentos de cada pedido se empiezan a guardar en la carpeta "Taller Hawaiira · Documentos".',
  cancelado: 'Se canceló la conexión con Google Drive.',
  permiso: 'Solo Dirección puede conectar Google Drive.',
  variables: 'Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel (instructivo, paso 4.6).',
  vencido: 'La conexión con Google tardó demasiado. Inténtalo otra vez.',
  'sin-permiso': 'Google no entregó el permiso permanente. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.',
  error: 'No se pudo conectar Google Drive. Revisa el instructivo, paso 4.6.',
};

function tabsPara(rol) {
  if (rol === 'operador') return ['taller'];
  if (rol === 'direccion') return ['tablero', 'pedidos', 'taller', 'costos', 'ajustes', 'usuarios'];
  if (rol === 'jefa') return ['tablero', 'pedidos', 'taller', 'costos', 'ajustes'];
  if (rol === 'admin') return ['tablero', 'pedidos', 'taller', 'costos'];
  if (rol === 'compras') return ['tablero', 'pedidos', 'taller', 'materiales'];
  return ['tablero', 'pedidos', 'taller'];
}

export default function App({ perfil, cliente }) {
  const supabase = useMemo(() => cliente || createClient(), [cliente]);
  const permitidas = useMemo(() => tabsPara(perfil.rol), [perfil.rol]);
  const [tab, setTab] = useState(permitidas[0]);
  const [config, setConfig] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [historial, setHistorial] = useState({});
  const [tiempos, setTiempos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [costosCfg, setCostosCfg] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [hitos, setHitos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const veMateriales = MATERIAL_ROLES.includes(perfil.rol), veCostos = COSTO_ROLES.includes(perfil.rol);
  const [live, setLive] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState(null);
  const [tour, setTour] = useState(false);
  const [avisosAbierto, setAvisosAbierto] = useState(false);
  const [sugerirAvisos, setSugerirAvisos] = useState(false);
  const recibe = RECIBE_AVISOS(perfil.rol);
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
    tiempos: async () => { const { data } = await supabase.from('v_tiempos').select('*'); setTiempos(data || []); },
    historial: async () => { const { data } = await supabase.from('historial').select('*'); setHistorial(Object.fromEntries((data || []).map((h) => [h.semana, h]))); },
    // Seguimiento del flujo (si aún no se corrió la migración 06, quedan vacíos)
    hitos: async () => { const { data } = await supabase.from('hitos').select('*'); setHitos(data || []); },
    documentos: async () => { const { data } = await supabase.from('documentos').select('clave, orden_id, cotizacion_id, tipo, nombre, url, estado').neq('tipo', 'registro'); setDocumentos(data || []); },
    ...(veMateriales ? {
      materiales: async () => { const { data } = await supabase.from('materiales').select('*').order('categoria').order('nombre'); setMateriales(data || []); },
      consumos: async () => { const { data } = await supabase.from('consumos').select('*').order('ts', { ascending: false }).limit(5000); setConsumos(data || []); },
    } : {}),
    ...(veCostos ? {
      costos: async () => { const { data } = await supabase.from('costos_config').select('data').eq('id', 1).single(); setCostosCfg(data?.data || null); },
      cotizaciones: async () => { const { data } = await supabase.from('cotizaciones').select('*').order('creado', { ascending: false }); setCotizaciones(data || []); },
    } : {}),
  }), [supabase, veMateriales, veCostos]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('tab'); // al tocar una notificación o al volver de Google
      const t = q || localStorage.getItem('tab');
      if (t && permitidas.includes(t)) setTab(t);
      const dr = params.get('drive');
      if (dr) avisar(DRIVE_MSJ[dr] || 'Google Drive: ' + dr);
      if (q) window.history.replaceState(null, '', '/');
    } catch {}
    Promise.all(Object.values(cargar).map((f) => f())).finally(() => setCargando(false));
    const timers = {};
    const refrescar = (tabla) => { clearTimeout(timers[tabla]); timers[tabla] = setTimeout(() => cargar[tabla](), 250); };
    const canal = supabase.channel('taller')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => { refrescar('ordenes'); refrescar('tiempos'); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => { refrescar('registros'); refrescar('tiempos'); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, () => refrescar('config'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => refrescar('perfiles'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hitos' }, () => refrescar('hitos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, () => refrescar('documentos'));
    if (veMateriales) canal
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiales' }, () => refrescar('materiales'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, () => refrescar('consumos'));
    if (veCostos) canal
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costos_config' }, () => refrescar('costos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' }, () => refrescar('cotizaciones'));
    canal.subscribe((s) => setLive(s === 'SUBSCRIBED'));
    // Al volver a la app después de un rato, refresca todo
    const vis = () => { if (document.visibilityState === 'visible') Object.values(cargar).forEach((f) => f()); };
    document.addEventListener('visibilitychange', vis);
    return () => { supabase.removeChannel(canal); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, cargar]);

  // Abre el tutorial la primera vez que la persona entra en este dispositivo
  useEffect(() => {
    if (cargando) return;
    try { if (!localStorage.getItem('tutorial:' + perfil.id)) setTour(true); } catch {}
  }, [cargando, perfil.id]);
  const cerrarTour = useCallback(() => {
    setTour(false);
    try { localStorage.setItem('tutorial:' + perfil.id, '1'); } catch {}
  }, [perfil.id]);
  const pasos = useMemo(() => pasosTutorial(perfil), [perfil]);

  // Notificaciones: este dispositivo queda a nombre de quien inició sesión, y se revisan novedades al abrir
  useEffect(() => {
    if (cargando) return;
    vincularDispositivo(supabase, recibe);
    if (!recibe) return;
    try {
      const ult = +localStorage.getItem('revision') || 0;
      if (Date.now() - ult > 5 * 60000) { localStorage.setItem('revision', String(Date.now())); revisarNovedades(); }
      if (pushSoportado() && Notification.permission === 'default' && !localStorage.getItem('sugerir-avisos:' + perfil.id)) setSugerirAvisos(true);
    } catch {}
  }, [cargando, supabase, recibe, perfil.id]);
  const noSugerir = () => { setSugerirAvisos(false); try { localStorage.setItem('sugerir-avisos:' + perfil.id, '1'); } catch {} };
  const setTabTour = useCallback((t) => setTab(t), []);

  const A = useMemo(() => aprender(config, tiempos), [config, tiempos]);
  // Los pedidos que esperan la orden de compra no entran en el plan del taller
  const enPlan = useMemo(() => ordenes.filter((o) => o.estado !== 'espera'), [ordenes]);
  const M = useMemo(() => crearMotor({ config: A.efectivo, ordenes: enPlan, perfiles, historial }), [A, enPlan, perfiles, historial]);

  const cambiarTab = (t) => { setTab(t); try { localStorage.setItem('tab', t); } catch {} window.scrollTo(0, 0); };
  const K = useMemo(() => (veCostos ? crearCostos({ M, cc: costosCfg, materiales }) : null), [veCostos, M, costosCfg, materiales]);
  const ctx = { supabase, perfil, M, K, A, tiempos, ordenes, perfiles, registros, config, materiales, consumos, cotizaciones, hitos, documentos, veMateriales, veCostos, avisar, recargar: cargar };

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
            {recibe && <button className="btn sm" data-tour="avisos" onClick={() => setAvisosAbierto(true)}>Notificaciones</button>}
            <button className="btn sm" data-tour="ayuda" onClick={() => setTour(true)}>Tutorial</button>
            <form action="/api/salir" method="post" data-tour="salir"><button className="btn sm" type="submit">Salir</button></form>
          </div>
        </div>
        {permitidas.length > 1 && (
          <nav className="tabs" role="tablist" data-tour="pestanas">
            {permitidas.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => cambiarTab(t)}>{TABS[t]}</button>
            ))}
          </nav>
        )}
      </header>
      <main className="wrap">
        {!cargando && perfil.rol !== 'operador' && !A.entregados && (
          <div className="banner">Los tiempos de producción todavía son estimados. Se vuelven reales cuando se entregue el primer pedido con piezas registradas: los tiempos son el resultado de cada pedido entregado.</div>
        )}
        {sugerirAvisos && !tour && (
          <div className="banner accion">
            <span>Activa las notificaciones para enterarte de pedidos nuevos, alertas en rojo y producción aunque la app esté cerrada.</span>
            <span className="acts"><button className="btn sm primary" onClick={() => { noSugerir(); setAvisosAbierto(true); }}>Activar</button><button className="btn sm link" onClick={noSugerir}>Ahora no</button></span>
          </div>
        )}
        {cargando ? <div className="empty">Cargando el taller…</div> : (
          <>
            {tab === 'tablero' && <Tablero {...ctx} />}
            {tab === 'pedidos' && <Pedidos {...ctx} />}
            {tab === 'taller' && <MiTrabajo {...ctx} />}
            {tab === 'costos' && <Costos {...ctx} />}
            {tab === 'materiales' && <Materiales {...ctx} />}
            {tab === 'ajustes' && <Ajustes {...ctx} />}
            {tab === 'usuarios' && <Usuarios {...ctx} />}
          </>
        )}
      </main>
      <Actualizacion bloqueado={tour || avisosAbierto} />
      {avisosAbierto && <Avisos supabase={supabase} perfil={perfil} avisar={avisar} onClose={() => setAvisosAbierto(false)} />}
      {tour && !cargando && <Tutorial pasos={pasos} permitidas={permitidas} setTab={setTabTour} onClose={cerrarTour} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>Deshacer</button>}
        </div>
      )}
    </>
  );
}
