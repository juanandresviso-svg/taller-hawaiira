import { createClient } from '@/lib/supabase/server';

// Persona que hace la llamada (solo rutas /api). Devuelve null si no hay sesión o el acceso está desactivado.
export async function quienLlama() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from('perfiles').select('id, nombre, rol, activo').eq('id', user.id).single();
  if (!perfil || !perfil.activo) return null;
  return perfil;
}
