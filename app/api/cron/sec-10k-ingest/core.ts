
import { fmpGet } from "@/lib/fmp/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface SecFiling {
  symbol: string;
  fillingDate: string;
  acceptedDate: string;
  period: string;
  type: string;
  link: string;
  finalLink: string;
}

interface FinancialReport {
  symbol: string;
  cik: string;
  year: number; // This is often the calendar year of the report
  period: string;
  // Key items we care about
  item1?: string; // Business
  item1a?: string; // Risk Factors
  item2?: string; // Properties
  item7?: string; // MD&A
}

// Keywords for analysis
const GEO_KEYWORDS = ["China", "EU", "United States", "Mexico", "Canada"];
const ENV_KEYWORDS = ["mining", "energy", "manufacturing"];

export async function ingestSEC10K(year: number) {
  console.log(`[SEC-10K] Starting ingestion for year ${year}`);

  // 1. Get list of 10-K filings for the year
  // We use a high limit or pagination. For simplicity, let's start with a high limit.
  // FMP sec_filings limit defaults to 100.
  const filings = await fmpGet<SecFiling[]>("/v3/sec_filings", {
    type: "10-K",
    year: year,
    limit: 3000 // Reasonable batch size? Or should we paginate?
  });

  if (!filings || filings.length === 0) {
    console.log(`[SEC-10K] No filings found for year ${year}`);
    return { count: 0, processed: 0, skipped: 0 };
  }

  console.log(`[SEC-10K] Found ${filings.length} filings. Processing...`);

  let processed = 0;
  let skipped = 0;

  // Process in chunks to manage concurrency
  const CHUNK_SIZE = 5;
  for (let i = 0; i < filings.length; i += CHUNK_SIZE) {
    const chunk = filings.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (filing) => {
      try {
        const ticker = filing.symbol;
        
        // 2. Idempotency Check
        // Check if we already have a record for this ticker and year
        // Note: 'year' in the cron is likely the fiscal year we want to tag.
        // However, the filing year might differ. 
        // We will trust the cron input year as the target fiscal year or use the filing's date.
        // Better: The user says "Idempotent per (ticker, fiscal_year)".
        // FMP financial-reports-json returns a year. We should use THAT year.
        
        // Let's optimize: Check if we have *any* entry for this ticker/year in DB first?
        // But we don't know the exact fiscal year until we fetch the report or assume it from filing date.
        // Let's optimistically fetch report. It's cleaner.
        // Actually, we can check DB after we parse the year from the report? 
        // Or assume filing year - 1 or same year?
        // Let's fetch the report first. It contains the correct fiscal year.

        // Wait, fetching full report is heavy.
        // Let's check if we have an entry for this ticker and the requested year (cron param) first.
        // But a 2024 filing might be for 2023 fiscal year.
        // Let's fetch the report. The user says "Fetch FMP financial-reports-json".
        
        const reports = await fmpGet<FinancialReport[]>("/v4/financial-reports-json", {
          symbol: ticker,
          year: year,
          period: "FY"
        });

        if (!reports || reports.length === 0) {
           // Maybe it's filed in 2024 but fiscal year is 2023?
           // The cron param 'year' usually matches the FMP 'year' param.
           skipped++;
           return;
        }

        const report = reports[0];
        const fiscalYear = report.year; // Trust FMP's year

        // Check DB for existence
        const { data: existing } = await supabaseAdmin
          .from("fintra_sec_structural_signals")
          .select("id")
          .eq("ticker", ticker)
          .eq("fiscal_year", fiscalYear)
          .maybeSingle();

        if (existing) {
          // console.log(`[SEC-10K] Skipping ${ticker} ${fiscalYear} - already exists`);
          skipped++;
          return;
        }

        // 3. Extract Text
        const textContent = [
            report.item1, 
            report.item1a, 
            report.item7, 
            report.item2
        ].join(" ").toLowerCase(); // Lowercase for easier matching

        // 4. Deterministic Parsing
        
        // Supplier Concentration
        let supplier_concentration = "medium";
        if (textContent.includes("limited number of suppliers") || textContent.includes("single supplier") || textContent.includes("sole supplier")) {
             supplier_concentration = "high";
        } else if (textContent.includes("multiple suppliers") && !textContent.includes("limited number of suppliers")) {
             supplier_concentration = "low";
        }

        // Single Source Dependency
        const single_source_dependency = textContent.includes("sole supplier") || textContent.includes("single supplier");

        // Geographic Exposure
        const geographic_exposure = GEO_KEYWORDS.filter(geo => {
            // Check if geo is mentioned. Simple includes check on original text (case insensitive)
            // We use the joined text but need to be careful.
            // Let's use a regex with word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${geo}\\b`, 'i');
            return regex.test(textContent);
        });

        // Environmental Exposure
        // "mining / energy / manufacturing -> medium or high"
        // We will default to null/undefined if not found, or set specific logic.
        // User says: "mining / energy / manufacturing -> medium or high"
        // I'll set to "high" if any found for safety/visibility.
        let environmental_exposure: string | null = null;
        const hasEnvKeywords = ENV_KEYWORDS.some(kw => textContent.includes(kw));
        if (hasEnvKeywords) {
            environmental_exposure = "high"; // Conservative
        } else {
             environmental_exposure = "low";
        }

        // Purchase Obligations Amount
        // "numeric extraction from obligations table"
        // This is the hardest part.
        // Look for "Purchase obligations" or "Contractual obligations"
        // Then try to find a number following it.
        // Simplified regex approach:
        let purchase_obligations_amount: number | null = null;
        let purchase_obligations_currency = "USD"; // Default

        // Regex to find "Purchase obligations ... $123" or "123"
        // We look in Item 7 (MD&A) specifically if available, else full text.
        const mda = (report.item7 || textContent).toLowerCase();
        
        // Pattern: "purchase obligations" ... (some small distance) ... number
        // This is very fuzzy.
        // Let's look for the table context.
        // If we can't find it reliably, we might skip it or leave null.
        // User asked for "numeric extraction".
        // Let's try to match "Total purchase obligations" followed by a number.
        const obligRegex = /(?:purchase|contractual)\s+obligations.*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i;
        const obligMatch = mda.match(obligRegex);
        if (obligMatch && obligMatch[1]) {
             // Clean number
             const rawNum = obligMatch[1].replace(/,/g, '');
             purchase_obligations_amount = parseFloat(rawNum);
        }

        // 5. Persistence
        const { error } = await supabaseAdmin
          .from("fintra_sec_structural_signals")
          .upsert({
            ticker: ticker,
            fiscal_year: fiscalYear,
            supplier_concentration,
            single_source_dependency,
            purchase_obligations_amount,
            purchase_obligations_currency,
            geographic_exposure,
            environmental_exposure,
            source: "SEC_10K"
          }, { onConflict: 'ticker, fiscal_year' });

        if (error) {
            console.error(`[SEC-10K] DB Error for ${ticker}:`, error.message);
        } else {
            processed++;
        }

      } catch (e) {
        console.error(`[SEC-10K] Error processing ${filing.symbol}:`, e);
      }
    }));
  }

  return { count: filings.length, processed, skipped };
}
