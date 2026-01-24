
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
 * IFS v1.1: BLOCK-BASED MAJORITY VOTING
 * 
 * Windows are grouped into 3 Blocks:
 * - Short: 1W, 1M
 * - Mid: YTD, 1Y
 * - Long: 3Y, 5Y
 * 
 * BLOCK VOTING:
 * Each block casts a single vote:
 * - +1 if majority of its valid windows are POSITIVE
 * - -1 if majority of its valid windows are NEGATIVE
 * -  0 if tie or no valid data
 * 
 * FINAL POSITION:
 * - Leader: Positive Blocks > Negative Blocks
 * - Laggard: Negative Blocks > Positive Blocks
 * - Follower: Tie
 * 
 * VALIDITY:
 * - Requires at least 2 non-zero block votes to be valid.
 *   If fewer than 2 blocks emit a non-zero vote → returns NULL.
 * 
 * PRESSURE:
 * - Number of blocks that support the final position.
 * - For Follower (Tie), pressure is the max intensity (max of pos/neg blocks).
 */
export function calculateIFS(inputs: RelativePerformanceInputs): IFSResult | null {
  // 1. Group Windows into Blocks
  const blocks = {
    short: [inputs.relative_vs_sector_1w, inputs.relative_vs_sector_1m],
    mid: [inputs.relative_vs_sector_ytd, inputs.relative_vs_sector_1y],
    long: [inputs.relative_vs_sector_3y, inputs.relative_vs_sector_5y]
  };

  // 2. Compute Block Votes
  const votes: number[] = []; // +1, -1, 0

  for (const group of Object.values(blocks)) {
    let pos = 0;
    let neg = 0;
    let valid = 0;

    for (const w of group) {
      if (w !== null && w !== undefined) {
        valid++;
        if (w > 0) pos++;
        else if (w < 0) neg++;
      }
    }

    if (valid === 0) {
      votes.push(0);
    } else if (pos > neg) {
      votes.push(1);
    } else if (neg > pos) {
      votes.push(-1);
    } else {
      votes.push(0); // Tie within block or empty
    }
  }

  // 3. Count Block Votes
  const positiveBlocks = votes.filter(v => v === 1).length;
  const negativeBlocks = votes.filter(v => v === -1).length;
  const nonZeroBlocks = positiveBlocks + negativeBlocks;

  // 4. Validity Rule: Need at least 2 non-zero block votes
  if (nonZeroBlocks < 2) {
    return null;
  }

  // 5. Determine Position & Pressure
  let position: IFSResult['position'] = 'follower';
  let pressure = 0;

  if (positiveBlocks > negativeBlocks) {
    position = 'leader';
    pressure = positiveBlocks;
  } else if (negativeBlocks > positiveBlocks) {
    position = 'laggard';
    pressure = negativeBlocks;
  } else {
    position = 'follower';
    pressure = Math.max(positiveBlocks, negativeBlocks);
  }

  return {
    position,
    pressure
  };
}
