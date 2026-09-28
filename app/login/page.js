'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [modo, setModo] = useState('entrar');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!email.trim()) return setErr('Escribe tu correo.');
    const supabase = createClient();
    setBusy(true);
    if (modo === 'entrar') {
      if (!clave) { setBusy(false); return setErr('Escribe tu contraseña.'); }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
      setBusy(false);
      if (error) return setErr('Correo o contraseña incorrectos.');
      router.replace('/');
      router.refresh();
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/cuenta/clave`,
      });
      setBusy(false);
      if (error) return setErr('No se pudo enviar el correo. Intenta de nuevo en unos minutos.');
      setMsg('Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.');
    }
  }

  return (
    <main className="auth">
      <div className="box">
        <img src="/logo.svg" alt="Hawaiira Studio" />
        <h1>{modo === 'entrar' ? 'Entrar al taller' : 'Recuperar contraseña'}</h1>
        <form onSubmit={entrar} noValidate>
          <label className="f">Correo
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {modo === 'entrar' && (
            <label className="f">Contraseña
              <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            </label>
          )}
          {err && <div className="err" role="alert">{err}</div>}
          {msg && <div className="okmsg" role="status">{msg}</div>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Enviar enlace'}
          </button>
          <button type="button" className="btn link" onClick={() => { setModo(modo === 'entrar' ? 'recuperar' : 'entrar'); setErr(''); setMsg(''); }}>
            {modo === 'entrar' ? 'Olvidé mi contraseña' : 'Volver a entrar'}
          </button>
        </form>
        <p>¿No tienes acceso? Pídele una invitación a dirección.</p>
      </div>
    </main>
  );
}
