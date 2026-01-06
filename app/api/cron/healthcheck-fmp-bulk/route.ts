// Fintra/app/api/cron/healthcheck-fmp-bulk/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'fmp_bulk_snapshots';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: state } = await supabase
    .from('cron_state')
    .select('last_run_date')
    .eq('name', CRON_NAME)
    .single();

  // Nunca corrió
  if (!state?.last_run_date) {
    await sendAlert(`⚠️ FINTRA ALERTA\nEl cron ${CRON_NAME} nunca corrió.`);
    return NextResponse.json({ alert: true, reason: 'never_ran' });
  }

  // No corrió hoy
  if (state.last_run_date < today) {
    await sendAlert(
      `🚨 FINTRA ALERTA\nEl cron ${CRON_NAME} NO corrió hoy.\nÚltima corrida: ${state.last_run_date}`
    );
    return NextResponse.json({ alert: true, reason: 'stale' });
  }

  return NextResponse.json({ ok: true, last_run: state.last_run_date });
}

// --- ALERTA TELEGRAM ---
async function sendAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });
}
// Empty
