import { createClient } from '@supabase/supabase-js';

// Cliente con la clave secreta: SOLO se usa en el servidor (rutas /api).
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
