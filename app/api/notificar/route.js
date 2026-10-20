import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revisarYAvisar } from '@/lib/push';

export const dynamic = 'force-dynamic';

// La app la llama después de cada cambio (pedido, registro, cotización, salida de material)
// y al abrirse. Revisa el taller y envía las notificaciones nuevas que correspondan.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  try {
    const r = await revisarYAvisar(createAdminClient(), { actor: user.id });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('notificar', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
