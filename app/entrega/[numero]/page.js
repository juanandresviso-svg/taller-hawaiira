import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ordenDesdeDb } from '@/lib/motor';
import { nombreArchivoNota } from '@/lib/notaEntrega';
import HojaEntrega from '@/components/HojaEntrega';
import Imprimir from './imprimir';

export const dynamic = 'force-dynamic';

async function cargar(numero) {
  const n = parseInt(numero, 10);
  if (!(n > 0)) return null;
  const supabase = await createClient();
  const [{ data: ords }, { data: cfg }] = await Promise.all([
    supabase.from('ordenes').select('*').eq('nota_entrega', n).order('codigo'),
    supabase.from('config').select('data').eq('id', 1).single(),
  ]);
  if (!ords || !ords.length) return null;
  const ordenes = ords.map((r) => ({ ...ordenDesdeDb(r), notaObs: r.nota_obs || '' }));
  const cliId = ords.find((r) => r.cliente_id)?.cliente_id;
  let cli = null;
  if (cliId) ({ data: cli } = await supabase.from('clientes').select('*').eq('id', cliId).maybeSingle());
  // Las descripciones salen de la cotización (algunos cargos no leen esa tabla: se lee con la llave del servidor, sin precios)
  const ids = [...new Set(ordenes.map((o) => o.cotizacionId).filter(Boolean))];
  let cots = [];
  if (ids.length) {
    ({ data: cots } = await supabase.from('cotizaciones').select('id, items, ordenes').in('id', ids));
    if ((!cots || cots.length < ids.length) && process.env.SUPABASE_SECRET_KEY) {
      try { ({ data: cots } = await createAdminClient().from('cotizaciones').select('id, items, ordenes').in('id', ids)); } catch {}
    }
    cots = (cots || []).map((c) => ({ ...c, items: (c.items || []).map(({ codigo, descripcion, nombre, producto }) => ({ codigo, descripcion, nombre, producto })) }));
  }
  return { numero: n, ordenes, cli, cots, productos: (cfg?.data || {}).productos || {} };
}

export async function generateMetadata({ params }) {
  const { numero } = await params;
  const d = await cargar(numero);
  return { title: d ? nombreArchivoNota(d.numero, d.ordenes[0].cliente) : 'Nota de entrega · Hawaiira Studio' };
}

export default async function NotaEntrega({ params }) {
  const { numero } = await params;
  const d = await cargar(numero);
  if (!d) notFound();
  return <HojaEntrega {...d} barra={<Imprimir nombre={nombreArchivoNota(d.numero, d.ordenes[0].cliente)} />} />;
}
