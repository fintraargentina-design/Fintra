export interface QualityBrakesInput {
  fgosScore: number;
  altmanZ?: number | null;
  piotroskiScore?: number | null;
}

export interface QualityBrakesResult {
  adjustedScore: number;
  confidence: number;
  warnings: string[];
  quality_brakes: {
    applied: boolean;
    reasons: string[];
  };
}

export function applyQualityBrakes(
  input: QualityBrakesInput,
): QualityBrakesResult {
  let { fgosScore, altmanZ, piotroskiScore } = input;

  let penalty = 0;
  const warnings: string[] = [];

  // ─────────────────────────
  // Altman Z (riesgo estructural)
  // ─────────────────────────
  if (Number.isFinite(altmanZ)) {
    if (altmanZ! < 1.8) {
      penalty += 15;
      warnings.push("Altman Z bajo (riesgo financiero)");
    } else if (altmanZ! < 3.0) {
      penalty += 5;
      warnings.push("Altman Z zona gris");
    }
  }

  // ─────────────────────────
  // Piotroski (calidad contable)
  // ─────────────────────────
  if (Number.isFinite(piotroskiScore)) {
    if (piotroskiScore! <= 3) {
      penalty += 15;
      warnings.push("Piotroski bajo (calidad débil)");
    } else if (piotroskiScore! <= 6) {
      penalty += 5;
      warnings.push("Piotroski medio");
    }
  }

  const confidence = Math.max(0, 100 - penalty);

  let adjustedScore = fgosScore;
  if (confidence < 50) {
    adjustedScore = Math.round(fgosScore * 0.9);
  }

  // Quality Brakes Diagnostic
  const reasons: string[] = [];
  if (Number.isFinite(altmanZ) && altmanZ! < 1.8) {
    reasons.push("altman_distress");
  }
  if (Number.isFinite(piotroskiScore) && piotroskiScore! <= 3) {
    reasons.push("piotroski_weak");
  }

  return {
    adjustedScore,
    confidence,
    warnings,
    quality_brakes: {
      applied: reasons.length > 0,
      reasons,
    },
  };
}
