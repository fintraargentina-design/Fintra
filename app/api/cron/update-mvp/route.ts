import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Configuración para Vercel (Timeout alto para que no se corte)
export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

// LISTA MVP
const WATCHLIST_MVP = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD'];

export async function GET() {
  // Verificamos las keys
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // O usa SUPABASE_URL según tu env
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const fmpKey = process.env.FMP_API_KEY!;

  if (!supabaseKey || !fmpKey) {
    return NextResponse.json({ error: 'Faltan API Keys' }, { status: 500 });
  }

  // Cliente con permisos de admin (Service Role)
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const results = { success: [] as string[], failed: [] as string[] };

  console.log('🚀 Iniciando Cron Job MVP (Cálculo Real)...');

  for (const symbol of WATCHLIST_MVP) {
    try {
      console.log(`Processing ${symbol}...`);

      // 1. OBTENER DATOS REALES DE FMP
      const [quoteRes, ratiosRes] = await Promise.all([
        fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${fmpKey}`)
      ]);

      const quoteData = await quoteRes.json();
      const ratiosData = await ratiosRes.json();

      if (!quoteData[0] || !ratiosData[0]) {
        throw new Error('No data from FMP');
      }

      // Extraemos métricas clave
      const price = quoteData[0].price;
      const pe = ratiosData[0].priceEarningsRatioTTM || 0;
      const roe = ratiosData[0].returnOnEquityTTM || 0;
      const debtToEquity = ratiosData[0].debtEquityRatioTTM || 0;

      // 2. CÁLCULO DE VALUACIÓN (0-100)
      // Lógica: Si PE es bajo (ej. 15) -> Score alto. Si PE es alto (ej. 50) -> Score bajo.
      let valuationScore = 0;
      if (pe > 0) {
         // Fórmula simple: Base 100, descontamos puntos si el PE sube de 15
         valuationScore = Math.max(0, Math.min(100, 100 - (pe - 15) * 1.5)); 
      }
      
      let valuationStatus = 'Justa';
      if (valuationScore > 65) valuationStatus = 'Infravalorada';
      if (valuationScore < 35) valuationStatus = 'Sobrevalorada';

      // 3. CÁLCULO DE FGOS (Cálculo Real)
      // Profitability: ROE alto es bueno. (ROE 0.5 = 50% -> 100 pts)
      const profitabilityScore = Math.min(100, (roe * 100) * 2); 
      // Solvency: Deuda baja es buena. (D/E 0 -> 100 pts. D/E 5 -> 0 pts)
      const solvencyScore = Math.min(100, Math.max(0, 100 - (debtToEquity * 20))); 
      
      // Promedio ponderado simple para el total
      const finalFgos = Math.round((profitabilityScore * 0.6) + (solvencyScore * 0.4)); 

      // Armamos el breakdown con números reales
      const fgosBreakdown = {
        profitability: Math.round(profitabilityScore),
        solvency: Math.round(solvencyScore),
        growth: 50,    // Placeholder (podrías mejorarlo con revenueGrowth)
        efficiency: 50, // Placeholder
        sentiment: 50, // Placeholder
        moat: 50,      // Placeholder
        note: "Calculated via FMP Live Data"
      };

      // 4. GENERAR VERDICTO AUTOMÁTICO
      let verdict = "Neutral";
      if (finalFgos > 75 && valuationStatus === 'Undervalued') verdict = "Oportunidad de Calidad";
      else if (finalFgos > 75) verdict = "Calidad (Hold)";
      else if (finalFgos < 40) verdict = "Alto Riesgo";
      else if (valuationStatus === 'Overvalued') verdict = "Cara / Esperar";

      // 5. UPSERT A SUPABASE (Usando columna 'ticker')
      const { error } = await supabase.from('fintra_snapshots').upsert({
        ticker: symbol, // IMPORTANTE: Usamos 'ticker' para coincidir con tu DB
        date: new Date().toISOString().split('T')[0], // Fecha YYYY-MM-DD
        fgos_score: finalFgos,
        fgos_breakdown: fgosBreakdown, // JSONB real
        valuation_score: Math.round(valuationScore),
        valuation_status: valuationStatus,
        verdict_text: verdict,
        ecosystem_score: 50, // Neutro por ahora
        ecosystem_health_score: 50, // Neutro por ahora
        pe_ratio: pe,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'ticker, date' }); // IMPORTANTE: Conflict target

      if (error) throw error;

      results.success.push(symbol);

    } catch (error: any) {
      console.error(`Error en ${symbol}:`, error.message);
      results.failed.push(symbol);
    }
  }

  return NextResponse.json(results);
}