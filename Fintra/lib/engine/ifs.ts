export interface IFSResult {
  position: "leader" | "follower" | "laggard";
  pressure: number;
  confidence: number; // 0-100
  confidence_label?: "High" | "Medium" | "Low";
  interpretation?: string;
}

export interface RelativePerformanceInputs {
  relative_vs_sector_1m: number | null;
  relative_vs_sector_3m: number | null;
  relative_vs_sector_6m: number | null;
  relative_vs_sector_1y: number | null;
  relative_vs_sector_2y: number | null;
  relative_vs_sector_3y: number | null;
  relative_vs_sector_5y: number | null;
}

interface IFSConfidenceInputs {
  availableWindows: number; // Cuántas ventanas tienen datos (de 7 posibles)
  signalConsistency: number; // 0-1, unanimidad de señales
  sectorUniverseSize?: number; // Tamaño del universo sectorial (opcional)
}

/**
 * Calculates confidence score for IFS based on data availability and signal consistency.
 */
function calculateIFSConfidence(inputs: IFSConfidenceInputs): number {
  const {
    availableWindows,
    signalConsistency,
    sectorUniverseSize = 50,
  } = inputs;

  // Factor 1: Data availability (40%)
  const maxWindows = 7; // 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y
  const availabilityScore = (availableWindows / maxWindows) * 100;

  // Factor 2: Signal consistency (40%)
  const consistencyScore = signalConsistency * 100;

  // Factor 3: Sector universe (20%)
  let universeScore = 0;
  if (sectorUniverseSize >= 100) universeScore = 100;
  else if (sectorUniverseSize >= 50) universeScore = 75;
  else if (sectorUniverseSize >= 20) universeScore = 50;
  else universeScore = 25;

  // Ponderación
  const confidence =
    availabilityScore * 0.4 + consistencyScore * 0.4 + universeScore * 0.2;

  return Math.round(confidence);
}

/**
 * Get confidence label based on numeric confidence score.
 */
function getConfidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 75) return "High";
  if (confidence >= 50) return "Medium";
  return "Low";
}

/**
 * Calculates Industry Fit Score (IFS) based on relative performance against sector.
 *
 * IFS v1.2: INDUSTRY-AWARE STRUCTURAL VOTING
 *
 * Windows are grouped into 3 Blocks:
 * - Short: 1M, 3M
 * - Mid: 6M, 1Y, 2Y
 * - Long: 3Y, 5Y
 *
 * INDUSTRY AWARENESS:
 * - If `dominantHorizons` is provided, ONLY windows in that list participate.
 * - Windows outside the list are ignored (even if data exists).
 *
 * BLOCK VOTING:
 * Each block casts a single vote:
 * - +1 if majority of its PARTICIPATING windows are POSITIVE
 * - -1 if majority of its PARTICIPATING windows are NEGATIVE
 * -  0 if tie or no participating windows
 *
 * FINAL POSITION:
 * - Leader: Positive Blocks > Negative Blocks
 * - Laggard: Negative Blocks > Positive Blocks
 * - Follower: Tie
 *
 * VALIDITY:
 * - v1.2 (Metadata present): Requires at least 2 VALID BLOCKS.
 *   A block is VALID if it contains at least 1 dominant window (even if data is missing, structurally it exists).
 *   Wait, "fewer than 2 valid blocks" -> If a block has NO dominant windows, it's invalid.
 *   (e.g. Fast industry -> Long block (3Y, 5Y) has 0 dominant windows -> Invalid).
 *
 * - v1.1 (Legacy/Fallback): Requires at least 2 NON-ZERO block votes.
 *
 * PRESSURE:
 * - Number of blocks that support the final position.
 * - For Follower (Tie), pressure is the max intensity (max of pos/neg blocks).
 */
export function calculateIFS(
  inputs: RelativePerformanceInputs,
  dominantHorizons?: string[],
): IFSResult | null {
  // 1. Define Block Structure with Codes
  const allWindows = [
    // Short (removed 1W)
    { block: "short", code: "1M", val: inputs.relative_vs_sector_1m },
    { block: "short", code: "3M", val: inputs.relative_vs_sector_3m },
    // Mid (removed YTD)
    { block: "mid", code: "6M", val: inputs.relative_vs_sector_6m },
    { block: "mid", code: "1Y", val: inputs.relative_vs_sector_1y },
    { block: "mid", code: "2Y", val: inputs.relative_vs_sector_2y },
    // Long
    { block: "long", code: "3Y", val: inputs.relative_vs_sector_3y },
    { block: "long", code: "5Y", val: inputs.relative_vs_sector_5y },
  ];

  // 2. Compute Block Votes
  const votes: number[] = []; // +1, -1, 0
  let validBlocksCount = 0; // v1.2 metric (Structural validity)
  let nonZeroBlocksCount = 0; // v1.1 metric (Data validity)

  const blockNames = ["short", "mid", "long"];

  for (const blockName of blockNames) {
    const windowsInBlock = allWindows.filter((w) => w.block === blockName);

    let pos = 0;
    let neg = 0;
    let participatingCount = 0;
    let structuralCount = 0; // How many windows in this block are dominant?

    for (const w of windowsInBlock) {
      // Filter: If dominantHorizons exists, w.code must be in it.
      const isDominant = !dominantHorizons || dominantHorizons.includes(w.code);

      if (isDominant) {
        structuralCount++;

        // Data check
        if (w.val !== null && w.val !== undefined) {
          participatingCount++;
          if (w.val > 0) pos++;
          else if (w.val < 0) neg++;
        }
      }
    }

    // Determine Vote
    let vote = 0;
    if (participatingCount === 0) {
      vote = 0;
    } else if (pos > neg) {
      vote = 1;
    } else if (neg > pos) {
      vote = -1;
    } else {
      vote = 0; // Tie
    }
    votes.push(vote);

    // Update Metrics
    if (vote !== 0) nonZeroBlocksCount++;

    // v1.2 Validity: "A block EXISTS only if it contains ≥1 dominant window"
    // AND we probably need data for it to be useful?
    // The prompt says "fewer than 2 valid blocks".
    // If structuralCount > 0, the block is structurally valid for this industry.
    // If participatingCount == 0 (no data), is it a "valid block"?
    // Usually, "valid block" implies we have a signal.
    // If we have NO data for a block, it's a neutral signal (0).
    // If we have 2 blocks with NO data -> 0, 0. Result: Follower (Tie).
    // But is that useful? No.
    // So "valid block" likely means "Block with data".
    // Let's stick to participatingCount > 0.
    // Wait, step 3 says: "A block... Is NEUTRAL otherwise (no vote)".
    // So if participatingCount > 0, we have a vote (even if 0).
    // So validBlocksCount should track blocks with participating data.
    if (participatingCount > 0) {
      validBlocksCount++;
    }
  }

  // 3. Validity Check
  // v1.2: Industry Aware
  if (dominantHorizons) {
    // If we have metadata, we use the stricter filtering.
    // But for validity, do we require 2 valid blocks?
    // "null: fewer than 2 valid blocks"
    if (validBlocksCount < 2) {
      return null;
    }
  } else {
    // v1.1: Legacy behavior
    if (nonZeroBlocksCount < 2) {
      return null;
    }
  }

  // 4. Determine Position & Pressure
  const positiveBlocks = votes.filter((v) => v === 1).length;
  const negativeBlocks = votes.filter((v) => v === -1).length;

  let position: IFSResult["position"] = "follower";
  let pressure = 0;

  if (positiveBlocks > negativeBlocks) {
    position = "leader";
    pressure = positiveBlocks;
  } else if (negativeBlocks > positiveBlocks) {
    position = "laggard";
    pressure = negativeBlocks;
  } else {
    position = "follower";
    pressure = Math.max(positiveBlocks, negativeBlocks);
  }

  // 5. Calculate Confidence
  const totalWindows = Object.values(inputs).length;
  const availableWindows = Object.values(inputs).filter(
    (v) => v !== null && v !== undefined,
  ).length;

  // Signal consistency: all blocks agree = 1.0, mixed signals = lower
  let signalConsistency = 1.0;
  if (positiveBlocks > 0 && negativeBlocks > 0) {
    signalConsistency = 0.7; // Mixed signals
  } else if (validBlocksCount < 3) {
    signalConsistency = 0.4; // Low data coverage
  }

  const confidence = calculateIFSConfidence({
    availableWindows,
    signalConsistency,
    sectorUniverseSize: 50, // Default, could be passed as parameter
  });

  const interpretation = `${position.charAt(0).toUpperCase() + position.slice(1)} with ${pressure}/3 blocks supporting (${getConfidenceLabel(confidence)} confidence)`;

  return {
    position,
    pressure,
    confidence,
    confidence_label: getConfidenceLabel(confidence),
    interpretation,
  };
}
