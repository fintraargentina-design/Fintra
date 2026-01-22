import { supabaseAdmin } from '@/lib/supabase-admin';

export async function runComputeRanks() {
  console.log('🚀 [ComputeRanks] Starting deterministic sector ranking...');
  const t0 = Date.now();

  try {
    // Call the SQL function
    const { error } = await supabaseAdmin.rpc('compute_sector_ranks');

    if (error) {
      throw error;
    }

    const duration = Date.now() - t0;
    console.log(`✅ [ComputeRanks] Completed in ${duration}ms`);

    return {
      success: true,
      duration_ms: duration,
    };

  } catch (error: any) {
    console.error('🔥 [ComputeRanks] Failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
