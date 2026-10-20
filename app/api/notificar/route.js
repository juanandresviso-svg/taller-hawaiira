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
  after(async () => {
    try { await seguimiento(createAdminClient(), { actor: user.id, limite: 5 }); } catch (e) { console.error('seguimiento', e.message); }
  });
  try {
    const r = await revisarYAvisar(createAdminClient(), { actor: user.id });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('notificar', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
