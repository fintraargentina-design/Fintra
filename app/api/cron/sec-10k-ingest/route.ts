
import { NextResponse } from "next/server";
import { ingestSEC10K } from "./core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    
    if (!yearParam) {
        return NextResponse.json({ error: "Year parameter is required" }, { status: 400 });
    }
    
    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
        return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const result = await ingestSEC10K(year);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[SEC-10K Cron] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
