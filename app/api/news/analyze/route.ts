import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow enough time for scraping + LLM

interface AnalyzeRequest {
  title: string;
  date: string;
  source: string;
  symbol: string;
  url: string;
}

interface LLMResponse {
  news_type: 'Hecho' | 'Anuncio' | 'Opinión' | 'Análisis';
  direction: 'Positiva' | 'Neutra' | 'Negativa';
  narrative_vector: string[];
  confidence: 'Alta' | 'Media' | 'Baja';
  explanation: string;
}

// Helper: Normalize Date to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  // Handle ISO strings or simple dates
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date format');
  }
  return d.toISOString().split('T')[0];
}

// Helper: Generate Canonical ID
function generateCanonicalId(url: string, source: string, date: string): string {
  // 1. Normalize URL
  let normalizedUrl = url.toLowerCase();
  try {
    const urlObj = new URL(normalizedUrl);
    // Remove query params and hash
    normalizedUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    // Remove trailing slash
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }
  } catch (e) {
    // Fallback if URL parsing fails (unlikely if validated)
    normalizedUrl = normalizedUrl.split('?')[0].split('#')[0];
  }

  // 2. Create signature string
  const signature = `${normalizedUrl}|${source}|${date}`;

  // 3. SHA256
  return crypto.createHash('sha256').update(signature).digest('hex');
}

// Helper: Clean Article Text
function cleanArticleText(html: string): string {
  if (!html) return '';

  // 1. Remove scripts, styles, noscript
  let cleaned = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
    .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gim, '');

  // 2. Prefer <article> content
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1]) {
    cleaned = articleMatch[1];
  }

  // 3. Extract text from paragraphs (fallback to raw text if no p tags found?)
  // The rule says "Fallback to concatenated <p> tags". 
  // If we are inside <article>, we still want to look for <p> or just strip tags?
  // "Fallback to concatenated <p> tags" implies if <article> is not found, use <p> from body.
  // If <article> IS found, we should probably extract text from it. 
  // Let's look for <p> tags inside the current 'cleaned' context (which is either article or full html).
  
  const pMatches = cleaned.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  
  let rawParagraphs: string[] = [];
  
  if (pMatches) {
    rawParagraphs = pMatches.map(p => {
      // Remove HTML tags
      return p.replace(/<[^>]+>/g, '').trim();
    });
  } else {
    // Fallback: strip all tags from the content if no <p> tags found
    // This handles cases where text is in <div>s or just plain text
    rawParagraphs = [cleaned.replace(/<[^>]+>/g, '').trim()];
  }

  // 4. Clean and Filter
  const validParagraphs = rawParagraphs
    .map(p => {
      // Collapse whitespace
      return p.replace(/\s+/g, ' ').trim();
    })
    .filter(p => {
      // Discard paragraphs shorter than ~50 chars
      return p.length >= 50;
    });

  return validParagraphs.join('\n\n');
}

export async function POST(req: Request) {
  try {
    // 1. Validate input
    const body = await req.json();
    const { title, date, source, symbol, url } = body as AnalyzeRequest;

    if (!url || !source || !symbol || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: url, source, symbol, date' },
        { status: 400 }
      );
    }

    // 2. Build canonical_id
    let normalizedDate: string;
    try {
      normalizedDate = normalizeDate(date);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const canonicalId = generateCanonicalId(url, source, normalizedDate);

    // 3. Deduplication lookup
    const { data: existingSnapshot, error: lookupError } = await supabaseAdmin
      .from('news_insight_snapshots')
      .select('*')
      .eq('canonical_id', canonicalId)
      .eq('analysis_version', 1)
      .single();

    if (existingSnapshot) {
      // Cache hit - return immediately
      return NextResponse.json(existingSnapshot);
    }

    if (lookupError && lookupError.code !== 'PGRST116') {
      // Real DB error (PGRST116 is "No rows found")
      console.error('Database lookup error:', lookupError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 4. Fetch article HTML
    let html = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        console.warn(`Fetch failed with status: ${response.status}`);
        return NextResponse.json({ error: 'Failed to fetch article' }, { status: 502 });
      }
      html = await response.text();
    } catch (error) {
      console.error('Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: 502 });
    }

    // 5. Extract article text
    const articleText = cleanArticleText(html);
    const evidenceLevel = articleText.length < 200 ? 'summary' : 'full';

    // 6. Call the LLM
    const n8nUrl = 'https://n8n.srv904355.hstgr.cloud/webhook/19d4e091-5368-4b5e-b4b3-71257abbd92d';
    
    // Send ONLY the specified fields
    const llmPayload = {
      title,
      date, // Pass original date or normalized? "date" in input. Let's pass original to be safe, or normalized. Prompt says "date".
      source,
      symbol,
      articleText,
    };

    let llmResult: LLMResponse;
    try {
      const llmResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(llmPayload),
      });

      if (!llmResponse.ok) {
        throw new Error(`LLM service failed with status: ${llmResponse.status}`);
      }

      llmResult = await llmResponse.json();
    } catch (error) {
      console.error('LLM call error:', error);
      return NextResponse.json({ error: 'LLM analysis failed' }, { status: 502 });
    }

    // 7. Compute eligibility
    // is_eligible_for_history = evidence_level === 'full' AND confidence !== 'Baja'
    const isEligible = evidenceLevel === 'full' && llmResult.confidence !== 'Baja';

    // 8. Insert snapshot into Supabase
    const snapshotData = {
      canonical_id: canonicalId,
      symbol,
      source,
      url,
      published_date: normalizedDate,
      news_type: llmResult.news_type,
      direction: llmResult.direction,
      narrative_vector: llmResult.narrative_vector,
      confidence: llmResult.confidence,
      evidence_level: evidenceLevel,
      explanation: llmResult.explanation,
      is_eligible_for_history: isEligible,
      analysis_version: 1,
    };

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('news_insight_snapshots')
      .insert(snapshotData)
      .select()
      .single();

    if (insertError) {
      // Handle potential race condition (duplicate key) if two requests came in simultaneously
      if (insertError.code === '23505') { // Unique violation
         const { data: retryData, error: retryError } = await supabaseAdmin
          .from('news_insight_snapshots')
          .select('*')
          .eq('canonical_id', canonicalId)
          .eq('analysis_version', 1)
          .single();
          
          if (retryData) return NextResponse.json(retryData);
      }

      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
    }

    // 9. Return inserted row
    return NextResponse.json(insertedData);

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
