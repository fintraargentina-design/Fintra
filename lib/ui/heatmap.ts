
export type HeatmapDirection = "positive" | "negative" | "neutral";

const POSITIVE_SCALE = [
  "#001A00", // very weak
  "#003300", // weak
  "#004D00", // moderate
  "#006600", // strong
  "#008000", // very strong
];

const NEGATIVE_SCALE = [
  "#1A0000", // very weak
  "#330000", // weak
  "#4D0000", // moderate
  "#660000", // strong
  "#800000", // very strong
];

export function getHeatmapColor(
  normalized: number | null | undefined,
  direction: HeatmapDirection
): string {
  // No data → no color
  if (normalized == null || Number.isNaN(normalized)) {
    return "transparent";
  }

  // Neutral metrics should not bias visually
  if (direction === "neutral") {
    return "transparent";
  }

  // Clamp defensively
  const value = Math.max(0, Math.min(1, normalized));

  // Bucket index: 0–4
  const idx = Math.min(4, Math.floor(value * 5));

  return direction === "positive"
    ? POSITIVE_SCALE[idx]
    : NEGATIVE_SCALE[idx];
}
