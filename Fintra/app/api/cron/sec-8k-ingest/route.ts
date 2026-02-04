import { NextResponse } from "next/server";
import { ingestSEC8K } from "./core";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Simple security check (optional, but good practice if exposed)
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    const result = await ingestSEC8K(page, limit);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[SEC-8K Cron] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
