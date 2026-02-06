import { supabaseAdmin } from "./lib/supabase-admin";

async function checkCash() {
  const { count, error } = await supabaseAdmin
    .from("datos_financieros")
    .select("cash_and_equivalents", { count: "exact", head: true })
    .not("cash_and_equivalents", "is", null);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total records with cash_and_equivalents: ${count}`);

  // Get percentage
  const { count: total } = await supabaseAdmin
    .from("datos_financieros")
    .select("*", { count: "exact", head: true });

  const pct = ((count / total) * 100).toFixed(2);
  console.log(`Coverage: ${pct}% (${count} / ${total})`);
}

checkCash();
