import { SupabaseClient } from "@supabase/supabase-js";

export async function upsertDatosFinancieros(
  client: SupabaseClient,
  rows: any[],
) {
  if (!rows.length) return;

  const { error } = await client.from("datos_financieros").upsert(rows, {
    onConflict: "ticker,period_type,period_label",
    ignoreDuplicates: false, // CHANGED: Update existing rows on conflict
  });

  if (error) {
    const tickers = Array.from(new Set(rows.map((r: any) => r.ticker))).slice(
      0,
      50,
    );
    console.error("[datos_financieros] Upsert error for tickers:", tickers);
    throw error;
  }
}
