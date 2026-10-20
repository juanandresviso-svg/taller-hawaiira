'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Formulario({ token }) {
  const router = useRouter();
  const [f, setF] = useState({ nombre: '', email: '', password: '', repetir: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErr('');
    if (!f.nombre.trim()) return setErr('Escribe tu nombre y apellido.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr('Escribe un correo válido.');
    if (f.password.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.');
    if (f.password !== f.repetir) return setErr('Las contraseñas no coinciden.');
    setBusy(true);
    const r = await fetch('/api/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, nombre: f.nombre, email: f.email, password: f.password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return setErr(j.error || 'No se pudo crear la cuenta.'); }
    const { error } = await createClient().auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.password });
    if (error) { setBusy(false); router.replace('/login'); return; }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label className="f">Nombre y apellido<input id="r-nombre" autoComplete="name" value={f.nombre} onChange={set('nombre')} /></label>
      <label className="f">Correo<input id="r-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
      <label className="f">Contraseña (mínimo 8 caracteres)<input id="r-clave" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></label>
      <label className="f">Repite la contraseña<input id="r-clave2" type="password" autoComplete="new-password" value={f.repetir} onChange={set('repetir')} /></label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Creando tu cuenta…' : 'Crear mi cuenta'}</button>
      <p className="small muted">¿Ya tienes cuenta? <a href="/login">Entra aquí</a>.</p>
    </form>
  );
}
