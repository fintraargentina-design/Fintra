import { NextResponse } from 'next/server';
import { fmpGet } from '@/lib/fmp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FmpNewsItem {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  try {
    // Fetch news from FMP
    const fmpNews = await fmpGet<FmpNewsItem[]>(`/api/v3/stock_news`, {
      tickers: symbol,
      limit: 50
    });

    // Transform to Alpha Vantage format expected by frontend
    const feed = Array.isArray(fmpNews) ? fmpNews.map(item => ({
      title: item.title,
      url: item.url,
      time_published: item.publishedDate.replace(/-/g, "").replace(/:/g, "").replace(" ", "T"), // AV format: YYYYMMDDTHHMMSS
      authors: [item.site],
      summary: item.text,
      banner_image: item.image,
      source: item.site,
      category_within_source: "General",
      source_domain: item.site,
      topics: [],
      overall_sentiment_score: 0,
      overall_sentiment_label: "Neutral",
      ticker_sentiment: []
    })) : [];

    return NextResponse.json({
      items: feed.length.toString(),
      sentiment_score_definition: "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish",
      relevance_score_definition: "0 < x <= 1: Low to High",
      feed: feed
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
