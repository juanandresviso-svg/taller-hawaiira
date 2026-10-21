import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revisarYAvisar } from '@/lib/push';
import { seguimiento } from '@/lib/seguimiento';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// La app la llama después de cada cambio (pedido, registro, cotización, salida de material, paso del flujo)
// y al abrirse. Revisa el taller, envía las notificaciones nuevas y actualiza el seguimiento en Google Drive.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  // Después de responder: registra los pasos cumplidos del flujo y guarda los documentos en Google Drive
  // Sigue por tandas hasta que no quede nada pendiente (o se acabe el tiempo): los documentos llegan a Drive de inmediato
  after(async () => {
    const t0 = Date.now();
    try {
      for (let i = 0; i < 6 && Date.now() - t0 < 40000; i++) {
        const r = await seguimiento(createAdminClient(), { actor: user.id, limite: 6 });
        const d = r && r.drive;
        if (!d || !d.conectado || !(d.pendientes > 0 || d.organizados > 0)) break;
      }
    } catch (e) { console.error('seguimiento', e.message); }
  });
  try {
    const r = await revisarYAvisar(createAdminClient(), { actor: user.id });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('notificar', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
