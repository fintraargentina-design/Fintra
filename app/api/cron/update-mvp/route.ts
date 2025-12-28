import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Configuración para Vercel (Timeout alto para procesar muchas acciones)
export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

// LISTA MVP (6 Líderes por Sector)
const WATCHLIST_MVP = [
  'AAPL', 'MSFT', 'NVDA', 'AMD', 'ORCL', 'CRM', // Tech
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'TMUS', // Comm
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', // Cons Disc
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', // Cons Stap
  'JPM', 'BAC', 'V', 'MA', 'BRK.B', 'GS', // Fin
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', // Health
  'CAT', 'GE', 'HON', 'UNP', 'UPS', 'BA', // Ind
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', // Energy
  'LIN', 'SHW', 'FCX', 'SCCO', 'NEM', 'DOW', // Mat
  'PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', // RE
  'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'D' // Util
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

  console.log(`🚀 Iniciando Cron Job PRO para ${WATCHLIST_MVP.length} acciones...`);

  for (const symbol of WATCHLIST_MVP) {
    try {
      // 1. OBTENER DATOS (Agregamos 'financial-growth' para el score de Growth)
      const [quoteRes, ratiosRes, growthRes] = await Promise.all([
        fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${fmpKey}`),
        fetch(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=1&apikey=${fmpKey}`)
      ]);

      const quoteData = await quoteRes.json();
      const ratiosData = await ratiosRes.json();
      const growthData = await growthRes.json();

      if (!quoteData?.[0] || !ratiosData?.[0]) {
        console.warn(`Skipping ${symbol}: No data`);
        results.failed.push(`${symbol} (No Data)`);
        continue; 
      }

      // Extraemos métricas crudas
      const q = quoteData[0];
      const r = ratiosData[0];
      const g = growthData[0] || {};

      const price = q.price;
      const priceAvg200 = q.priceAvg200 || price; // Para Sentiment técnico
      
      const pe = r.priceEarningsRatioTTM || 0;
      const roe = r.returnOnEquityTTM || 0;             // Profitability
      const debtToEquity = r.debtEquityRatioTTM || 0;   // Solvency
      const netMargin = r.netProfitMarginTTM || 0;      // Efficiency
      const grossMargin = r.grossProfitMarginTTM || 0;  // Moat Proxy
      const revGrowth = g.revenueGrowth || 0;           // Growth (Puede venir como 0.15 para 15%)

      // -------------------------------------------------------
      // 2. CÁLCULO DE SCORES (Normalización 0-100)
      // -------------------------------------------------------

      // A. Profitability (Rentabilidad): ROE > 20% es excelente
      const scoreProfit = Math.min(100, Math.max(0, (roe * 100) * 5)); 

      // B. Solvency (Solvencia): D/E < 0.5 es excelente. > 2.0 es malo.
      // Fórmula: 100 - (D/E * 30). Si D/E es 0 -> 100. Si es 3 -> 10.
      const scoreSolvency = Math.min(100, Math.max(0, 100 - (debtToEquity * 30)));

      // C. Efficiency (Eficiencia): Net Margin > 20% es excelente (depende sector, pero rule of thumb)
      const scoreEfficiency = Math.min(100, Math.max(0, (netMargin * 100) * 4));

      // D. Growth (Crecimiento): Revenue Growth > 15% es excelente
      const scoreGrowth = Math.min(100, Math.max(0, (revGrowth * 100) * 5));

      // E. Moat (Ventaja): Gross Margin > 60% es indicio de Moat fuerte
      const scoreMoat = Math.min(100, Math.max(0, (grossMargin * 100) * 1.5));

      // F. Sentiment (Técnico): Si Precio > Media 200, es alcista (Sentiment > 50)
      let scoreSentiment = 50; 
      if (price > priceAvg200) scoreSentiment = 75; // Alcista
      else scoreSentiment = 25; // Bajista

      // -------------------------------------------------------
      
      // Armamos el breakdown REAL (Ya no hay placeholders)
      const fgosBreakdown = {
        profitability: Math.round(scoreProfit),
        solvency: Math.round(scoreSolvency),
        growth: Math.round(scoreGrowth),
        efficiency: Math.round(scoreEfficiency),
        moat: Math.round(scoreMoat),
        sentiment: Math.round(scoreSentiment),
        note: "Calculated via FMP Full Data"
      };

      // Cálculo del FGOS Promedio (Score General)
      const finalFgos = Math.round(
        (scoreProfit + scoreSolvency + scoreGrowth + scoreEfficiency + scoreMoat + scoreSentiment) / 6
      );

      // Valuación (Mejorada para manejar PE negativo)
      let valuationScore = 0;
      let valuationStatus = 'N/A';

      if (pe > 0) {
         // Fórmula simple: Base 100, descontamos puntos si el PE sube de 15
         valuationScore = Math.max(0, Math.min(100, 100 - (pe - 15) * 1.5)); 
         
         if (valuationScore > 65) valuationStatus = 'Infravalorada';
         else if (valuationScore < 35) valuationStatus = 'Sobrevalorada';
         else valuationStatus = 'Justa';
      } else {
         // Si PE es negativo (pierde dinero), valuationScore = 0 ("Riesgo")
         valuationStatus = 'Pérdidas (Sin PE)';
      }

      // Veredicto
      let verdict = "Neutral";
      if (finalFgos > 75 && valuationStatus === 'Infravalorada') verdict = "Oportunidad de Calidad";
      else if (finalFgos > 80) verdict = "Calidad (Hold)";
      else if (finalFgos < 40) verdict = "Alto Riesgo";
      else if (valuationStatus === 'Sobrevalorada') verdict = "Cara / Esperar";

      // 3. UPSERT A SUPABASE
      const { error } = await supabase.from('fintra_snapshots').upsert({
        ticker: symbol,
        date: new Date().toISOString().split('T')[0],
        fgos_score: finalFgos,
        fgos_breakdown: fgosBreakdown, // ¡Datos Reales!
        valuation_score: Math.round(valuationScore),
        valuation_status: valuationStatus,
        verdict_text: verdict,
        ecosystem_score: 50, 
        pe_ratio: pe,
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