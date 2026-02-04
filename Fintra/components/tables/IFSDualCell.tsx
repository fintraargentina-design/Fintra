/**
 * IFS Dual Cell
 *
 * Displays both IFS Live and IQS side by side in table cells.
 *
 * LAYOUT:
 * ┌─────────┬─────────┐
 * │   IFS   │   IQS   │  ← Labels
 * │    L    │  🟡🟢🟢  │  ← Values
 * └─────────┴─────────┘
 *
 * IFS = IFS Live (momentum, daily, sector)
 * IQS = Industry Quality Score (structural, FY, industry)
 *
 * These two metrics COEXIST but never merge.
 */

import React from "react";
import { IQSPie } from "@/components/visuals/IFSFYPie";
import type { IFSData, IQSResult } from "@/lib/engine/types";

interface IFSDualCellProps {
  ifs: IFSData | null;
  ifs_fy: IQSResult | null;
  size?: "compact" | "standard" | "large";
}

const POSITION_LABELS = {
  leader: "LD",
  follower: "FL",
  laggard: "LG",
};

const POSITION_COLORS = {
  leader: "text-green-400",
  follower: "text-amber-400",
  laggard: "text-red-400",
};

const SIZE_CONFIG = {
  compact: {
    pieSize: 24,
    badgeSize: "w-7 h-5 text-[10px]",
    gap: "gap-1.5",
  },
  standard: {
    pieSize: 32,
    badgeSize: "w-10 h-8 text-xs",
    gap: "gap-3",
  },
  large: {
    pieSize: 48,
    badgeSize: "w-12 h-10 text-sm",
    gap: "gap-4",
  },
};

export function IFSDualCell({
  ifs,
  ifs_fy,
  size = "standard",
}: IFSDualCellProps) {
  const config = SIZE_CONFIG[size];

  return (
    <div className={`flex items-center justify-center ${config.gap}`}>
      {/* IFS Live Badge */}
      {ifs ? (
        <span
          className={`
            inline-flex items-center justify-center
            ${config.badgeSize}  font-semibold 
            ${POSITION_COLORS[ifs.position]}
          `}
          title="IFS Live
Current competitive position
Benchmark: Sector
Frequency: Daily snapshot"
        >
          {POSITION_LABELS[ifs.position]}
        </span>
      ) : (
        <span className="text-zinc-600 text-xs" title="IFS Live: No data">
          —
        </span>
      )}

      {/* Separator */}
      <span className="text-zinc-700 text-[10px] font-bold">/</span>

      {/* IQS Pie */}
      {ifs_fy && ifs_fy.fiscal_positions.length > 0 ? (
        <div className="relative group">
          <IQSPie
            fiscal_positions={ifs_fy.fiscal_positions}
            size={config.pieSize}
          />

          {/* Tooltip on hover */}
          <div
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              hidden group-hover:block
              bg-zinc-900 text-white text-xs rounded px-2 py-1.5
              whitespace-nowrap z-10 pointer-events-none
              shadow-lg border border-zinc-700
            "
          >
            <div className="font-semibold text-emerald-400">
              FY {ifs_fy.current_fy.fiscal_year}:{" "}
              {ifs_fy.current_fy.position.toUpperCase()}
            </div>
            <div className="text-zinc-400 text-[10px]">
              Years: {ifs_fy.fiscal_years.join(", ")}
            </div>
            <div className="text-zinc-500 text-[10px]">
              Confidence: {ifs_fy.confidence}%
            </div>
          </div>
        </div>
      ) : (
        <span
          className="text-zinc-600 text-xs"
          title="IQS – Industry Quality Score
Structural position based on FY fundamentals
Benchmark: Industry
Fiscal years shown explicitly
Confidence derived from FY count"
        >
          —
        </span>
      )}
    </div>
  );
}
