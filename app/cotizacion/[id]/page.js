import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cfgCostos } from '@/lib/costos';
import { nombreArchivo } from '@/lib/formatoCotizacion';
import HojaCotizacion from '@/components/HojaCotizacion';
import Imprimir from './imprimir';

export const dynamic = 'force-dynamic';

async function cargar(id) {
  const supabase = await createClient();
  const [{ data: c }, { data: cc }, { data: cfg }] = await Promise.all([
    supabase.from('cotizaciones').select('*').eq('id', id).single(),
    supabase.from('costos_config').select('data').eq('id', 1).single(),
    supabase.from('config').select('data').eq('id', 1).single(),
  ]);
  if (!c) return null;
  let cli = null;
  if (c.cliente_id) ({ data: cli } = await supabase.from('clientes').select('*').eq('id', c.cliente_id).maybeSingle());
  return { c, cli, emp: cfgCostos(cc?.data).empresa, productos: (cfg?.data || {}).productos || {} };
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
