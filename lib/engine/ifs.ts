
export interface IFSResult {
  position: 'leader' | 'follower' | 'laggard';
  pressure: number;
}

export interface RelativePerformanceInputs {
  relative_vs_sector_1w: number | null;
  relative_vs_sector_1m: number | null;
  relative_vs_sector_ytd: number | null;
  relative_vs_sector_1y: number | null;
  relative_vs_sector_3y: number | null;
  relative_vs_sector_5y: number | null;
}

/**
 * Calculates Industry Fit Score (IFS) based on relative performance against sector.
 * 
 * IFS is derived by MAJORITY VOTING across windows.
 * Windows: 1W, 1M, YTD, 1Y, 3Y, 5Y
 * 
 * POSITION RULE:
 * - Majority POSITIVE (>0) → "leader"
 * - Majority NEGATIVE (<0) → "laggard"
 * - Otherwise → "follower"
 * 
 * PRESSURE RULE (Structural Reinforcement):
 * - If leader: pressure = count of positive windows
 * - If laggard: pressure = count of negative windows
 * - If follower: pressure = max(positive_windows, negative_windows)
 * 
 * VALIDITY:
 * - If fewer than 3 valid windows exist → NULL
 */
export function calculateIFS(inputs: RelativePerformanceInputs): IFSResult | null {
  const windows = [
    inputs.relative_vs_sector_1w,
    inputs.relative_vs_sector_1m,
    inputs.relative_vs_sector_ytd,
    inputs.relative_vs_sector_1y,
    inputs.relative_vs_sector_3y,
    inputs.relative_vs_sector_5y
  ];

  let positiveCount = 0;
  let negativeCount = 0;
  let validCount = 0;

  for (const w of windows) {
    if (w !== null && w !== undefined) {
      validCount++;
      if (w > 0) positiveCount++;
      else if (w < 0) negativeCount++;
    }
  }

  // If fewer than 3 valid windows exist: ifs = NULL (do NOT fabricate)
  if (validCount < 3) {
    return null;
  }

  // POSITION & PRESSURE RULES
  let position: IFSResult['position'] = 'follower';
  let pressure = 0;
  
  if (positiveCount > negativeCount) {
    position = 'leader';
    pressure = positiveCount;
  } else if (negativeCount > positiveCount) {
    position = 'laggard';
    pressure = negativeCount;
  } else {
    // Tie -> follower
    // Pressure for follower is the max intensity of either side (though they are tied or close)
    // Actually per requirement: max(positives, negatives)
    position = 'follower';
    pressure = Math.max(positiveCount, negativeCount);
  }

  return {
    position,
    pressure
  };
}
