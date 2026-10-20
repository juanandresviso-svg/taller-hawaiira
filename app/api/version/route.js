import { NextResponse } from 'next/server';
import { NOVEDADES } from '@/lib/novedades';

export const dynamic = 'force-dynamic';

// La app instalada pregunta aquí cada pocos minutos si hay una versión nueva publicada.
export function GET() {
  const n = NOVEDADES[0] || {};
  return NextResponse.json({ version: process.env.APP_VERSION, novedad: { id: n.id, titulo: n.titulo } }, { headers: { 'Cache-Control': 'no-store' } });
}
