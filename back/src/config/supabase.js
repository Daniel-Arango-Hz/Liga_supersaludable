import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en .env');
}

// Cliente público (respeta RLS — para peticiones de usuario)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cliente admin (bypassea RLS — solo para operaciones internas del servidor)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
