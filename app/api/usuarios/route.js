import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/sitio';

const ROLES = ['direccion', 'jefa', 'admin', 'compras', 'diseno', 'ventas', 'operador'];
const ESTACIONES = ['', 'preprensa', 'corte', 'serigrafia', 'costura', 'dtf'];

// Invita a un usuario nuevo (solo Dirección). Supabase envía el correo desde el Gmail del taller (SMTP).
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const { data: yo } = await supabase.from('perfiles').select('rol, activo').eq('id', user.id).single();
  if (!yo || !yo.activo || yo.rol !== 'direccion') return NextResponse.json({ error: 'Solo Dirección puede invitar usuarios.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const nombre = String(body.nombre || '').trim();
  const rol = String(body.rol || 'operador');
  const estacion = String(body.estacion || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: 'Escribe el nombre de la persona.' }, { status: 400 });
  if (!ROLES.includes(rol) || !ESTACIONES.includes(estacion)) return NextResponse.json({ error: 'Rol o estación no válidos.' }, { status: 400 });

  const site = siteUrl(request);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre, rol, estacion },
    redirectTo: `${site}/cuenta/clave`,
  });

  if (error) {
    // Si ya existe, se le envía un enlace para crear una contraseña nueva.
    if (/already|registered|exists/i.test(error.message)) {
      const { error: e2 } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${site}/cuenta/clave` });
      if (e2) return NextResponse.json({ error: 'No se pudo reenviar el acceso: ' + e2.message }, { status: 400 });
      return NextResponse.json({ ok: true, reenviado: true });
    }
    return NextResponse.json({ error: 'No se pudo enviar la invitación: ' + error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
