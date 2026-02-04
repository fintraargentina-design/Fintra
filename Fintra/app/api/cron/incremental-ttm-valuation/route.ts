/**
 * API Route: Incremental TTM Valuation Cron
 *
 * Endpoint: /api/cron/incremental-ttm-valuation
 *
 * Purpose: Detects newly closed fiscal quarters and computes TTM valuation
 * Frequency: Daily (recommended after financials-bulk)
 *
 * STRICT RULES:
 * - Creates ONLY new TTM rows (one per newly closed quarter)
 * - Does NOT touch existing rows
 * - Idempotent (safe to re-run)
 */

import { NextRequest, NextResponse } from "next/server";
import { incrementalTTMValuation } from "@/scripts/pipeline/incremental-ttm-valuation";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🔄 [CRON] Incremental TTM Valuation started");

    await incrementalTTMValuation();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ [CRON] Incremental TTM Valuation completed in ${duration}s`,
    );

    return NextResponse.json({
      success: true,
      message: "Incremental TTM valuation completed",
      duration: `${duration}s`,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("❌ [CRON] Incremental TTM Valuation failed:", error);

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
