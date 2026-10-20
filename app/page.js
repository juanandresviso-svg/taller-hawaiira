import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import App from '@/components/App';

export default async function Inicio() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (!perfil || !perfil.activo) {
    return (
      <main className="auth"><div className="box">
        <img src="/logo.svg" alt="Hawaiira Studio" />
        <h1>Tu acceso está desactivado</h1>
        <p>Habla con dirección para que lo vuelva a activar.</p>
        <form action="/api/salir" method="post"><button className="btn" type="submit">Salir</button></form>
      </div></main>
    );
  }
  return <App perfil={perfil} />;
}
