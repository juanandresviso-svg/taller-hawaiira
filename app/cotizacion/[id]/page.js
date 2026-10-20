import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cfgCostos } from '@/lib/costos';
import { nombreArchivo } from '@/lib/formatoCotizacion';
import HojaCotizacion from '@/components/HojaCotizacion';
import Imprimir from './imprimir';

export const dynamic = 'force-dynamic';

async function cargar(id) {
  const supabase = await createClient();
  let [{ data: c }, { data: cc }, { data: cfg }] = await Promise.all([
    supabase.from('cotizaciones').select('*').eq('id', id).single(),
    supabase.from('costos_config').select('data').eq('id', 1).single(),
    supabase.from('config').select('data').eq('id', 1).single(),
  ]);
  if (!c) {
    // Ventas no lee la tabla de cotizaciones (tiene los costos): se carga con la llave del servidor, sin costos
    const { data: { user } } = await supabase.auth.getUser();
    const { data: yo } = user ? await supabase.from('perfiles').select('rol, activo').eq('id', user.id).maybeSingle() : { data: null };
    if (yo && yo.activo !== false && yo.rol === 'ventas' && process.env.SUPABASE_SECRET_KEY) ({ data: c } = await createAdminClient().from('cotizaciones').select('*').eq('id', id).maybeSingle());
  }
  if (!c) return null;
  c.items = (c.items || []).map(({ costo, ...it }) => it); // el costo no sale en la cotización
  // Ventas puede ver la cotización pero no los costos: los datos de la empresa se leen con la llave del servidor
  let emp = cc?.data;
  if (!emp && process.env.SUPABASE_SECRET_KEY) { try { const { data } = await createAdminClient().from('costos_config').select('data').eq('id', 1).single(); emp = data?.data; } catch {} }
  let cli = null;
  if (c.cliente_id) ({ data: cli } = await supabase.from('clientes').select('*').eq('id', c.cliente_id).maybeSingle());
  return { c, cli, emp: cfgCostos(emp).empresa, productos: (cfg?.data || {}).productos || {} };
}

// El título de la página es el nombre del PDF al guardarlo: "P279 CLIENTE - HAWAIIRA STUDIO"
export async function generateMetadata({ params }) {
  const { id } = await params;
  const d = await cargar(id);
  return { title: d ? nombreArchivo(d.c) : 'Cotización · Hawaiira Studio' };
}

export default async function Cotizacion({ params }) {
  const { id } = await params;
  const d = await cargar(id);
  if (!d) notFound();
  return <HojaCotizacion {...d} barra={<Imprimir nombre={nombreArchivo(d.c)} />} />;
}
