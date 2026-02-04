import { NextResponse } from "next/server";
import { directFetcher } from "@/lib/fmp/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  try {
    const { path } = await params;
    // Reconstruct the path (e.g. /news/general-latest)
    // Note: If the user requests /api/fmp/news/general-latest, params.path is ['news', 'general-latest']
    const joinedPath = "/" + path.join("/");
    
    // Delegate to directFetcher which maps internal paths to FMP Stable URLs
    const data = await directFetcher(joinedPath, { params: query });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Default cache control, can be overridden if directFetcher supported it
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30", 
      },
    });
  } catch (err: any) {
    console.error(`[/api/fmp] Error fetching ${req.url}:`, err?.message || err);
    return NextResponse.json(
      { error: err?.message ?? "FMP fetch failed" },
      { status: 500 }
    );
  }
}
