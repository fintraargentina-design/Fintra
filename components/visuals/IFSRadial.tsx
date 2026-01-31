import React from "react";
import { IFSData, IFSMemory } from "@/lib/engine/types";

export const IFSRadial = ({ ifs, ifsMemory }: { ifs?: IFSData | null, ifsMemory?: IFSMemory | null }) => {
  // Constants
  const cx = 10;
  const cy = 10;
  const r = 8;
  const gapDegrees = 10;
  const COLORS = {
    leader: "#10b981",   // emerald-500
    follower: "#f59e0b", // amber-500
    laggard: "#ef4444",  // red-500
    empty: "#27272a"     // zinc-800
  };

  // Fallback: No memory or no timeline -> Render neutral empty circle
  // We strictly require ifsMemory.timeline to be present.
  if (!ifsMemory || !ifsMemory.timeline || ifsMemory.timeline.length === 0) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke={COLORS.empty} strokeWidth="2" />
      </svg>
    );
  }

  // Determine number of segments (clamped 1-5)
  const totalSegments = Math.min(5, Math.max(1, ifsMemory.observed_years));
  const timeline = ifsMemory.timeline;

  const segments = [];

  for (let i = 0; i < totalSegments; i++) {
    // Get color from timeline history
    // Timeline is ordered oldest -> newest.
    // If timeline has fewer items than observed_years (should not happen in consistent state), use empty color.
    const position = timeline[i];
    const color = COLORS[position] || COLORS.empty;

    const startAngle = (i * 360) / totalSegments + (gapDegrees / 2);
    const endAngle = ((i + 1) * 360) / totalSegments - (gapDegrees / 2);

    // Polar to Cartesian
    // -90 to start from top (12 o'clock)
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const isLargeArc = (endAngle - startAngle) > 180 ? 1 : 0;

    const d = [
      "M", cx, cy,
      "L", x1, y1,
      "A", r, r, 0, isLargeArc, 1, x2, y2,
      "Z"
    ].join(" ");

    segments.push(
      <path
        key={i}
        d={d}
        fill={color}
        stroke="none"
      />
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      {segments}
    </svg>
  );
};
