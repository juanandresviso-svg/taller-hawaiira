import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLES, POOL_NAME } from '@/lib/motor';
import { enviarA } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Registro con un enlace de invitación: crea la cuenta con el rol y la estación del enlace.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const nombre = String(body.nombre || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!nombre) return NextResponse.json({ error: 'Escribe tu nombre y apellido.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });

  const db = createAdminClient();
  const { data: usadas, error: e1 } = await db.rpc('usar_invitacion', { p_token: token });
  const inv = Array.isArray(usadas) ? usadas[0] : usadas;
  if (e1 || !inv) return NextResponse.json({ error: 'Este enlace ya no es válido (venció, se desactivó o llegó al máximo de registros). Pide uno nuevo a dirección.' }, { status: 410 });

  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { nombre, rol: inv.rol, estacion: inv.estacion || '', invitacion_id: inv.id },
  });
  if (error) {
    await db.rpc('devolver_invitacion', { p_id: inv.id });
    const existe = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: existe ? 'Ya existe una cuenta con ese correo. Entra con tu contraseña o usa "Olvidé mi contraseña".' : 'No se pudo crear la cuenta: ' + error.message }, { status: existe ? 409 : 500 });
  }

  // Aviso a Dirección
  try {
    const { data: dir } = await db.from('perfiles').select('id').eq('rol', 'direccion').eq('activo', true);
    await enviarA(db, (dir || []).map((p) => p.id).filter((id) => id !== data.user.id), {
      title: `Nueva persona en la app: ${nombre}`,
      body: `${ROLES[inv.rol]}${inv.estacion ? ' · ' + POOL_NAME[inv.estacion] : ''} · ${email}. Revisa en Usuarios.`,
      url: '/?tab=usuarios', tag: 'usuario:' + data.user.id,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
