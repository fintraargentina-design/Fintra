import { createClient } from '@supabase/supabase-js';

// HACK: Cargar variables de entorno para scripts locales (fuera de Next.js)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.local' });
    
    // Si falla, intentar .env estándar
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      dotenv.config();
    }
  } catch (e) {
    // Ignorar si dotenv no está disponible
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

// Cliente con privilegios de administrador (Service Role)
// ÚNICAMENTE para uso en servidor (API Routes, Cron Jobs, Backfill)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
