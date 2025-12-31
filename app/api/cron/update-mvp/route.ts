import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Configuración para Vercel
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

// LISTA TOP 10 LÍDERES POR SECTOR (GICS)
// Total: 110 Tickers (Optimizado para Cron Job rápido)
const WATCHLIST_MVP = [
  // 1. Technology
  'AAPL', /* 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'AMD', 

  // 2. Communication Services
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'TMUS', 'VZ', 'T', 

  // 3. Consumer Discretionary
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'BKNG', 

  // 4. Consumer Staples
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO', 'EL', 

  // 5. Financials
  'JPM', 'BAC', 'V', 'MA', 'BRK.B', 'GS', 'MS', 'WFC', 

  // 6. Healthcare
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 

  // 7. Industrials
  'CAT', 'GE', 'HON', 'UNP', 'UPS', 'BA', 'DE', 'LMT', 

  // 8. Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC', 'PSX',

  // 9. Materials
  'LIN', 'SHW', 'FCX', 'SCCO', 'NEM', 'DOW', 'APD', 'ECL', 

  // 10. Real Estate
  'PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', 'PSA', 'DLR', 

  // 11. Utilities
  'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'D', 'PEG', 'EXC',  */
];

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; 
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const fmpKey = process.env.FMP_API_KEY!;

  if (!supabaseKey || !fmpKey) {
    return NextResponse.json({ error: 'Faltan API Keys' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const results = { success: [] as string[], failed: [] as string[] };
  console.log(`🚀 Iniciando Cron Job MASSIVE para ${WATCHLIST_MVP.length} acciones...`);

  for (const symbol of WATCHLIST_MVP) {
    try {
      // 1. OBTENER DATOS (Agregamos 'profile' para obtener el Sector)
      const [quoteRes, ratiosRes, growthRes, profileRes] = await Promise.all([
        fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=1&apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${fmpKey}`)
      ]);

      const quoteData = await quoteRes.json();
      const ratiosData = await ratiosRes.json();
      const growthData = await growthRes.json();
      const profileData = await profileRes.json();

      if (!quoteData?.[0] || !ratiosData?.[0]) {
        console.warn(`Skipping ${symbol}: No data`);
        results.failed.push(`${symbol} (No Data)`);
        continue; 
      }

      // Extraemos métricas
      const q = quoteData[0];
      const r = ratiosData[0];
      const g = growthData[0] || {};
      const p = profileData?.[0] || {}; // Datos de perfil (Sector)

      const price = q.price;
      const priceAvg200 = q.priceAvg200 || price;
      const sector = p.sector || 'Unknown'; // <-- Extraemos el sector aquí
      
      const pe = r.priceEarningsRatioTTM || 0;
      const roe = r.returnOnEquityTTM || 0;
      const debtToEquity = r.debtEquityRatioTTM || 0;
      const netMargin = r.netProfitMarginTTM || 0;
      const grossMargin = r.grossProfitMarginTTM || 0;
      const revGrowth = g.revenueGrowth || 0;

      // -------------------------------------------------------
      // 2. CÁLCULO DE SCORES (FGOS)
      // -------------------------------------------------------
      const scoreProfit = Math.min(100, Math.max(0, (roe * 100) * 5)); 
      const scoreSolvency = Math.min(100, Math.max(0, 100 - (debtToEquity * 30)));
      const scoreEfficiency = Math.min(100, Math.max(0, (netMargin * 100) * 4));
      const scoreGrowth = Math.min(100, Math.max(0, (revGrowth * 100) * 5));
      const scoreMoat = Math.min(100, Math.max(0, (grossMargin * 100) * 1.5));
      
      let scoreSentiment = 50; 
      if (price > priceAvg200) scoreSentiment = 75;
      else scoreSentiment = 25;

      const fgosBreakdown = {
        profitability: Math.round(scoreProfit),
        solvency: Math.round(scoreSolvency),
        growth: Math.round(scoreGrowth),
        efficiency: Math.round(scoreEfficiency),
        moat: Math.round(scoreMoat),
        sentiment: Math.round(scoreSentiment),
        note: "Calculated via FMP Full Data"
      };

      const finalFgos = Math.round(
        (scoreProfit + scoreSolvency + scoreGrowth + scoreEfficiency + scoreMoat + scoreSentiment) / 6
      );

      // Valuación
      let valuationScore = 0;
      let valuationStatus = 'N/A';
      if (pe > 0) {
         valuationScore = Math.max(0, Math.min(100, 100 - (pe - 15) * 1.5)); 
         if (valuationScore > 65) valuationStatus = 'Infravalorada';
         else if (valuationScore < 35) valuationStatus = 'Sobrevalorada';
         else valuationStatus = 'Justa';
      } else {
         valuationStatus = 'Pérdidas (Sin PE)';
      }

      // Veredicto
      let verdict = "Neutral";
      if (finalFgos > 75 && valuationStatus === 'Infravalorada') verdict = "Oportunidad de Calidad";
      else if (finalFgos > 80) verdict = "Calidad (Hold)";
      else if (finalFgos < 40) verdict = "Alto Riesgo";
      else if (valuationStatus === 'Sobrevalorada') verdict = "Cara / Esperar";

      // 3. UPSERT A SUPABASE (Incluyendo Sector)
      const { error } = await supabase.from('fintra_snapshots').upsert({
        ticker: symbol,
        date: new Date().toISOString().split('T')[0],
        
        // Scores
        fgos_score: finalFgos,
        fgos_breakdown: fgosBreakdown,
        valuation_score: Math.round(valuationScore),
        valuation_status: valuationStatus,
        verdict_text: verdict,
        
        // Nuevos Campos
        sector: sector, // <-- Guardamos el sector
        pe_ratio: pe,
        ecosystem_score: 50, // Placeholder hasta que corra el análisis de ecosistema real
        
        calculated_at: new Date().toISOString()
      }, { onConflict: 'ticker, date' });

      if (error) throw error;
      results.success.push(symbol);

    } catch (error: any) {
      console.error(`Error en ${symbol}:`, error.message);
      results.failed.push(symbol);
    }
  }

  return NextResponse.json(results);
}