// cron/validation/utils.ts
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function runCheck(
  name: string,
  checkFn: () => Promise<void>
) {
  try {
    await checkFn();
    console.log(`✅ ${name}`);
  } catch (err: any) {
    console.error(`❌ ${name}`);
    throw err; // corta todo
  }
}
