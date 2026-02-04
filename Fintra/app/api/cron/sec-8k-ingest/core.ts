import { fmpGet } from "@/lib/fmp/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * SEC 8-K Ingestion Job
 * 
 * Goals:
 * 1. Fetch latest 8-K filings from FMP (paginated).
 * 2. Parse HTML content to detect specific SEC Items (1.01, 1.02, 2.01, 5.02, 8.01).
 * 3. Classify events deterministically and idempotently.
 * 4. Store signals in `fintra_sec_event_signals`.
 * 
 * Constraints:
 * - No LLMs.
 * - No raw HTML storage.
 * - Deterministic parsing.
 */

type FMPFiling = {
  symbol: string;
  cik: string;
  formType: string; // "8-K"
  fillingDate: string;
  acceptedDate: string;
  link: string;
  finalLink: string;
};

type SecSignal = {
  ticker: string;
  filing_date: string;
  event_type: string;
  event_category: string;
  sec_item: string;
  link: string;
  accepted_date: string;
  priority: number;
};

// Priority map: Lower number = Higher priority
const EVENT_PRIORITIES: Record<string, { type: string; category: string; priority: number }> = {
  "1.01": { type: "material_agreement", category: "SUPPLY_CHAIN", priority: 1 },
  "1.02": { type: "agreement_termination", category: "SUPPLY_CHAIN", priority: 1 },
  "2.01": { type: "acquisition_disposition", category: "STRATEGIC", priority: 1 },
  "5.02": { type: "management_change", category: "GOVERNANCE", priority: 2 },
  "8.01": { type: "other_event", category: "CORPORATE", priority: 3 },
};

// Regex to detect items. We look for "Item X.XX" pattern.
// 8-K filings typically have headers like "Item 1.01 Entry into a Material Definitive Agreement".
// We use a regex that handles standard spaces and common HTML non-breaking spaces.
const ITEM_REGEX = /Item(?:\s|&nbsp;|&#160;)+(1\.01|1\.02|2\.01|5\.02|8\.01)/gi;

const MAX_PAGES_CATCHUP = 5; // Safety limit for auto-pagination

export async function ingestSEC8K(startPage = 0, limit = 100) {
  let currentPage = startPage;
  let totalProcessed = 0;
  let totalSignals = 0;
  let keepFetching = true;

  console.log(`[SEC-8K] Starting ingestion loop from page=${startPage} limit=${limit}`);

  while (keepFetching && currentPage < startPage + MAX_PAGES_CATCHUP) {
    console.log(`[SEC-8K] Fetching page ${currentPage}...`);
    
    // 1. Fetch filings from FMP
    const filings = await fmpGet<FMPFiling[]>("/sec_filings", {
      type: "8-K",
      page: currentPage,
      limit,
    });

    if (!filings || filings.length === 0) {
      console.log("[SEC-8K] No more filings found. Stopping.");
      break;
    }

    // 2. Check existence in DB to decide if we should continue to next page
    const links = filings.map((f) => f.finalLink);
    const { data: existing, error } = await supabaseAdmin
      .from("fintra_sec_event_signals")
      .select("link")
      .in("link", links);

    if (error) {
      console.error("[SEC-8K] Error checking existing filings:", error);
      throw error;
    }

    const existingLinks = new Set(existing?.map((e) => e.link) || []);
    const newFilings = filings.filter((f) => !existingLinks.has(f.finalLink));
    
    const allExists = newFilings.length === 0;
    const partialExists = existingLinks.size > 0;

    console.log(`[SEC-8K] Page ${currentPage}: ${newFilings.length} new / ${filings.length} total.`);

    // STOP CONDITION: If we find filings that already exist, we assume we have reached
    // the point where we left off last time. We process the new ones on this page and then stop.
    // If NO filings on this page exist, it means we might have a gap, so we continue to next page.
    if (partialExists || allExists) {
        console.log(`[SEC-8K] Found existing records on page ${currentPage}. This will be the last page.`);
        keepFetching = false;
    } else {
        // If everything is new, we must go deeper to find where we left off
        currentPage++;
    }

    if (newFilings.length === 0) {
      continue; 
    }

    // 3. Process new filings
    const signals = await processBatch(newFilings);
    
    totalProcessed += newFilings.length;
    totalSignals += signals;
  }

  return {
    processed: totalProcessed,
    signals: totalSignals,
    pagesScanned: currentPage - startPage + (keepFetching ? 0 : 1)
  };
}

async function processBatch(filings: FMPFiling[]): Promise<number> {
  let signalsToInsert: SecSignal[] = [];
  const CHUNK_SIZE = 5;
  
  for (let i = 0; i < filings.length; i += CHUNK_SIZE) {
    const chunk = filings.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (filing) => {
        try {
          return await processFiling(filing);
        } catch (err) {
          console.error(`[SEC-8K] Error processing ${filing.symbol}:`, err);
          return null;
        }
      })
    );
    signalsToInsert.push(...results.filter((s): s is SecSignal => s !== null));
  }

  if (signalsToInsert.length > 0) {
    const rows = signalsToInsert.map(({ priority, ...row }) => row);
    const { error } = await supabaseAdmin
      .from("fintra_sec_event_signals")
      .upsert(rows, { onConflict: "ticker,link" });

    if (error) {
      console.error("[SEC-8K] DB Insert Error:", error);
      throw error;
    }
    console.log(`[SEC-8K] Inserted ${rows.length} signals.`);
  }
  
  return signalsToInsert.length;
}

async function processFiling(filing: FMPFiling): Promise<SecSignal | null> {
  // Fetch HTML content
  const response = await fetch(filing.finalLink);
  if (!response.ok) {
    console.warn(`[SEC-8K] Failed to fetch HTML for ${filing.symbol}: ${response.status}`);
    return null;
  }
  const html = await response.text();

  // Parse items
  const detectedItems = new Set<string>();
  let match;
  // Reset regex state just in case, though usually not needed for local regex
  // But using global regex in loop needs care if shared. Here we use fresh matches.
  // We use matchAll or loop with exec.
  const regex = new RegExp(ITEM_REGEX); // Clone/Create new to be safe
  
  // Note: ITEM_REGEX is global, so we can loop.
  while ((match = ITEM_REGEX.exec(html)) !== null) {
    detectedItems.add(match[1]); // e.g. "1.01"
  }

  if (detectedItems.size === 0) {
    return null; // No relevant items found
  }

  // Determine highest impact event
  // Deterministic logic:
  // 1. We prioritize by 'priority' score (lower is better/higher impact).
  // 2. If priorities are equal, we keep the first one found in the document (FIFO).
  // This ensures that if a filing mentions both 1.01 and 1.02 (both priority 1),
  // the one that appears first (likely the primary topic) is selected.
  let bestSignal: SecSignal | null = null;

  for (const item of detectedItems) {
    const info = EVENT_PRIORITIES[item];
    if (!info) continue;

    if (!bestSignal || info.priority < bestSignal.priority) {
      bestSignal = {
        ticker: filing.symbol,
        filing_date: filing.fillingDate,
        event_type: info.type,
        event_category: info.category,
        sec_item: item,
        link: filing.finalLink,
        accepted_date: filing.acceptedDate,
        priority: info.priority,
      };
    }
  }

  return bestSignal;
}
