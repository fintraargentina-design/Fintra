import { supabaseAdmin } from '@/lib/supabase-admin';

const CRON_NAME = 'fmp_bulk_snapshots';

export type HealthCheckResult = {
  ok: boolean;
  alert: boolean;
  reason?: string;
  last_run?: string;
};

export async function checkSnapshotsHealth(): Promise<HealthCheckResult> {
  const today = new Date().toISOString().slice(0, 10);

  // CHECK REAL DATA instead of cron_state
  const { data: latestSnapshot } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  const lastRunDate = latestSnapshot?.snapshot_date;

  // Nunca corrió (o tabla vacía)
  if (!lastRunDate) {
    await sendAlert(`⚠️ FINTRA ALERTA\nEl cron ${CRON_NAME} nunca generó snapshots (tabla vacía).`);
    return { ok: false, alert: true, reason: 'never_ran' };
  }

  // No corrió hoy
  if (lastRunDate < today) {
    await sendAlert(
      `🚨 FINTRA ALERTA\nEl cron ${CRON_NAME} NO generó snapshots hoy.\nÚltima fecha detectada: ${lastRunDate}`
    );
    return { ok: false, alert: true, reason: 'stale', last_run: lastRunDate };
  }

  return { ok: true, alert: false, last_run: lastRunDate };
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
