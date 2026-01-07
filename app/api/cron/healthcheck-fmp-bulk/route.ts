// Fintra/app/api/cron/healthcheck-fmp-bulk/route.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'fmp_bulk_snapshots';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: state } = await supabaseAdmin
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram env vars missing, skipping alert');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });
  } catch (error) {
    console.error('Failed to send Telegram alert', error);
  }
}
