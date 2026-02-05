/**
 * IQS Pie Chart (Industry Quality Score)
 *
 * Renders pie chart with N slices (1-5) representing fiscal years.
 * Each slice has equal size and color based on position.
 *
 * USAGE:
 * - In tables: size={20} (compact)
 * - In cards: size={32} (standard)
 * - In detail views: size={48} (large)
 */

import React from "react";
import type { IQSFiscalYearPosition, IQSPosition } from "@/lib/engine/types";

interface IQSPieProps {
  fiscal_positions: IQSFiscalYearPosition[];
  size?: number;
  className?: string;
}

const COLORS = {
  leader: "#00CC00",
  follower: "#FFA028",
  laggard: "#CC0000",
  empty: "#e5e7eb", // Gray
};

export function IQSPie({
  fiscal_positions,
  size = 32,
  className = "",
}: IQSPieProps) {
  if (!fiscal_positions || fiscal_positions.length === 0) {
    // Empty state - gray circle with dashed border
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        className={className}
        aria-label="IQS: No fiscal year data"
      >
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke={COLORS.empty}
          strokeWidth="2"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const totalSlices = fiscal_positions.length;
  const anglePerSlice = 360 / totalSlices;
  const radius = 8;
  const centerX = 10;
  const centerY = 10;

  const paths: React.JSX.Element[] = [];

  for (let i = 0; i < totalSlices; i++) {
    const fy = fiscal_positions[i];
    const position: IQSPosition = fy.position;
    const color = COLORS[position as keyof typeof COLORS] || COLORS.empty;

    // Calculate start and end angles (clockwise, starting from top)
    // -90° offset to start at 12 o'clock position
    const startAngle = (i * anglePerSlice - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * anglePerSlice - 90) * (Math.PI / 180);

    // Calculate arc endpoints
    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    // Large arc flag (1 for angles >= 180°, 0 for < 180°)
    const largeArcFlag = anglePerSlice > 180 ? 1 : 0;

    // SVG path: Move to center, line to arc start, arc, close
    const pathData = [
      `M ${centerX} ${centerY}`, // Move to center
      `L ${startX} ${startY}`, // Line to arc start
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
      "Z", // Close path
    ].join(" ");

    paths.push(
      <path
        key={i}
        d={pathData}
        fill={color}
        stroke="white"
        strokeWidth="0.5"
        aria-label={`FY ${fy.fiscal_year}: ${position}`}
      />,
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      aria-label={`IQS: ${totalSlices} fiscal years, current position: ${fiscal_positions[fiscal_positions.length - 1].position}`}
    >
      {paths}
    </svg>
  );
}
