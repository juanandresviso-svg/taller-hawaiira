'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CrearClave() {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setErr('');
    if (clave.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.');
    if (clave !== clave2) return setErr('Las dos contraseñas no coinciden.');
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: clave });
    setBusy(false);
    if (error) return setErr('El enlace venció o ya se usó. Pide uno nuevo desde "Olvidé mi contraseña".');
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="auth">
      <div className="box">
        <img src="/logo.svg" alt="Hawaiira Studio" />
        <h1>Crea tu contraseña</h1>
        <p>La usarás para entrar desde la computadora, la tableta o el teléfono.</p>
        <form onSubmit={guardar} noValidate>
          <label className="f">Contraseña nueva
            <input id="clave" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
          <label className="f">Repite la contraseña
            <input id="clave2" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
          </label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
        </form>
      </div>
    </main>
  );
}
