import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ticker = 'TSLA';
  
  // 1. Check with Public Client (simulate Frontend)
  const { data: publicData, error: publicError } = await supabase
    .from('fintra_universe')
    .select('*')
    .eq('ticker', ticker);

  // 2. Check with Admin Client (simulate Backend/Cron)
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('fintra_universe')
    .select('*')
    .eq('ticker', ticker);

  return NextResponse.json({
    ticker,
    public_check: {
      found: publicData?.length || 0,
      data: publicData,
      error: publicError
    },
    admin_check: {
      found: adminData?.length || 0,
      data: adminData,
      error: adminError
    },
    diagnosis: publicData?.length === 0 && adminData?.length > 0 
      ? "RLS Issue: Backend sees it, Frontend doesn't." 
      : "Other Issue"
  });
}
