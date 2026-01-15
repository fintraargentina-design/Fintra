import { NextResponse } from 'next/server';

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
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
         return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    // User requested endpoints
    const pressReleasesUrl = `https://financialmodelingprep.com/stable/news/press-releases?symbols=${symbol}&apikey=${apiKey}`;
    const stockNewsUrl = `https://financialmodelingprep.com/stable/news/stock?symbols=${symbol}&apikey=${apiKey}`;

    // Parallel fetch
    const [pressRes, stockRes] = await Promise.all([
      fetch(pressReleasesUrl, { next: { revalidate: 300 } }), // Cache for 5 mins
      fetch(stockNewsUrl, { next: { revalidate: 300 } })
    ]);

    const pressData: FmpNewsItem[] = pressRes.ok ? await pressRes.json() : [];
    const stockData: FmpNewsItem[] = stockRes.ok ? await stockRes.json() : [];

    // Transform helper
    const transform = (item: FmpNewsItem, category: string) => ({
      title: item.title,
      url: item.url,
      time_published: item.publishedDate.replace(/-/g, "").replace(/:/g, "").replace(" ", "T"), // AV format: YYYYMMDDTHHMMSS
      authors: [item.site], // FMP often uses site as author/source
      summary: item.text,
      banner_image: item.image,
      source: item.site,
      category_within_source: category, // Set based on endpoint
      source_domain: item.site,
      topics: [],
      overall_sentiment_score: 0,
      overall_sentiment_label: "Neutral",
      ticker_sentiment: []
    });

    const feed = [
      ...pressData.map(item => transform(item, "Press Release")),
      ...stockData.map(item => transform(item, "Stock News"))
    ];

    // Sort by date descending
    feed.sort((a, b) => b.time_published.localeCompare(a.time_published));

    return NextResponse.json({
      items: feed.length.toString(),
      sentiment_score_definition: "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish",
      relevance_score_definition: "0 < x <= 1: Low to High",
      feed: feed
    });

  } catch (error) {
    console.error('Error fetching ticker news:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
