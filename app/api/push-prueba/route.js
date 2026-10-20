import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enviarA, pushConfigurado } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Envía una notificación de prueba a los dispositivos de quien la pide
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  if (!pushConfigurado()) return NextResponse.json({ error: 'Faltan las claves VAPID en Vercel (paso 12 del instructivo).' }, { status: 503 });
  const n = await enviarA(createAdminClient(), [user.id], { title: 'Taller Hawaiira', body: 'Las notificaciones funcionan en este dispositivo.', url: '/', tag: 'prueba' });
  return NextResponse.json({ ok: n > 0, enviados: n, error: n ? undefined : 'No hay dispositivos activados para tu usuario.' });
}
