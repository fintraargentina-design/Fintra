import React from "react";
import { IFSData, IFSMemory } from "@/lib/engine/types";

export const IFSRadial = ({ ifs, ifsMemory }: { ifs?: IFSData | null, ifsMemory?: IFSMemory | null }) => {
  // If no position, render completely empty/neutral state
  if (!ifs?.position) return <div className="w-4 h-4 rounded-full border border-zinc-800" />;

  const { position } = ifs;
  
  // Color Logic (Strictly based on Position)
  let color = "#71717a"; // zinc-500
  if (position === "leader") color = "#10b981"; // emerald-500
  else if (position === "follower") color = "#f59e0b"; // amber-500
  else if (position === "laggard") color = "#ef4444"; // red-500

  // Segment Logic (Strictly based on IFS Memory)
  // Edge Case: No memory or no observed years -> Empty state (just the container, or 0 segments)
  if (!ifsMemory || !ifsMemory.observed_years || ifsMemory.observed_years === 0) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="#27272a" strokeWidth="2" />
        </svg>
    );
  }

  const totalSegments = Math.min(5, Math.max(1, ifsMemory.observed_years));
  const filledSegments = ifsMemory.current_streak?.years || 0;
  const filled = Math.min(totalSegments, filledSegments);

  // Generate segments
  const segments = [];
  const cx = 10;
  const cy = 10;
  const r = 8;
  const gapDegrees = 10; 
  
  for (let i = 0; i < totalSegments; i++) {
    const startAngle = (i * 360) / totalSegments + (gapDegrees / 2);
    const endAngle = ((i + 1) * 360) / totalSegments - (gapDegrees / 2);
    
    // Polar to Cartesian
    // -90 to start from top
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    // SVG Path for Arc
    const d = [
      "M", cx, cy,
      "L", x1, y1,
      "A", r, r, 0, 0, 1, x2, y2,
      "Z"
    ].join(" ");

    segments.push(
      <path
        key={i}
        d={d}
        fill={i < filled ? color : "#27272a"} // zinc-800 for empty slots
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
