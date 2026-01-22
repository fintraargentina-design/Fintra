
import { use } from 'react';
import { getTickerFullView } from '@/lib/services/ticker-view.service';
import ExpandedPageClient from './ExpandedPageClient';

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function ExpandedTickerPage({ params }: PageProps) {
  const unwrappedParams = await params;
  // Decode ticker from URL (e.g. %5EGSPC -> ^GSPC)
  const ticker = decodeURIComponent(unwrappedParams.ticker).toUpperCase();

  // Fetch data from DB (Server-Side)
  const data = await getTickerFullView(ticker);

  return <ExpandedPageClient ticker={ticker} initialData={data} />;
}
