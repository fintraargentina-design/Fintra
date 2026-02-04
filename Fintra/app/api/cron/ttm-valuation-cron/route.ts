/**
 * API Route: TTM Valuation Cron
 *
 * Endpoint: /api/cron/ttm-valuation-cron
 *
 * Purpose: Detect newly closed fiscal quarters and compute TTM valuation
 * Frequency: Daily (after financials-bulk)
 *
 * Rules:
 * - Creates ONLY new TTM rows (one per newly closed quarter)
 * - NEVER modifies existing rows
 * - Idempotent (safe to re-run)
 */

import { NextRequest, NextResponse } from "next/server";
import { runTTMValuationCron } from "@/scripts/pipeline/ttm-valuation-cron";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🔄 [CRON] TTM Valuation started");

    await runTTMValuationCron();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [CRON] TTM Valuation completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: "TTM valuation cron completed",
      duration: `${duration}s`,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("❌ [CRON] TTM Valuation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: `${duration}s`,
      },
      { status: 500 },
    );
  }
}
