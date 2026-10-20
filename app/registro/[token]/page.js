import { createAdminClient } from '@/lib/supabase/admin';
import { ROLES, POOL_NAME } from '@/lib/motor';
import Formulario from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registro · Taller Hawaiira' };

export default async function Registro({ params }) {
  const { token } = await params;
  const db = createAdminClient();
  const { data: inv } = await db.from('invitaciones').select('rol, estacion, usos, max_usos, vence, activa').eq('token', token).maybeSingle();
  const valida = inv && inv.activa && (!inv.vence || new Date(inv.vence) > new Date()) && (inv.max_usos == null || inv.usos < inv.max_usos);
  return (
    <main className="auth">
      <div className="box">
        <img src="/logo.svg" alt="Hawaiira Studio" />
        {valida ? (
          <>
            <h1>Únete al taller</h1>
            <p style={{ marginTop: 0 }}>Te vas a registrar como <b>{ROLES[inv.rol]}</b>{inv.estacion ? <> · estación <b>{POOL_NAME[inv.estacion]}</b></> : null}.</p>
            <Formulario token={token} />
          </>
        ) : (
          <>
            <h1>Enlace no válido</h1>
            <p>Este enlace de invitación venció, se desactivó o ya no tiene cupos. Pide uno nuevo a dirección.</p>
            <p><a className="btn" href="/login">Ir a entrar</a></p>
          </>
        )}
      </div>
    </main>
  );
}
