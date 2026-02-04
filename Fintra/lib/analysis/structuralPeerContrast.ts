import { StructuralSignal } from "./structuralConsistency";
import { PeerContrast } from "./decisionPeerContrast";

/**
 * Evaluates structural consistency contrast between main ticker and peer.
 * Pure, deterministic, null-safe.
 * Max 2 contrasts returned.
 */
export function evaluateStructuralPeerContrast(
  mainSignals: StructuralSignal[],
  peerSignals: StructuralSignal[]
): PeerContrast[] {
  // Silent fail if inputs missing
  if (!mainSignals || !peerSignals) return [];

  const contrasts: PeerContrast[] = [];
  const has = (signals: StructuralSignal[], id: string) => signals.some(s => s.id === id);

  const mainFragile = has(mainSignals, "structural_fragility") || has(mainSignals, "episodic_performance");
  const peerFragile = has(peerSignals, "structural_fragility") || has(peerSignals, "episodic_performance");

  const mainStrong = has(mainSignals, "structural_profitability") || has(mainSignals, "structural_cash_generation");
  const peerStrong = has(peerSignals, "structural_profitability") || has(peerSignals, "structural_cash_generation");

  // 1. Shared structural fragility
  if (mainFragile && peerFragile) {
    contrasts.push({
      id: "shared-fragility",
      text: "Both profiles show limited structural consistency over time",
      tone: "warning",
      dimension: "risk"
    });
  }

  // 2. Relative fragility (Peer is fragile, Main is not)
  if (peerFragile && !mainFragile) {
    contrasts.push({
      id: "relative-fragility",
      text: "Peer exhibits higher structural instability across cycles",
      tone: "positive",
      dimension: "risk"
    });
  }

  // 3. Structural divergence (positive) (Main is strong, Peer is not)
  if (mainStrong && !peerStrong) {
    contrasts.push({
      id: "structural-divergence",
      text: "Main profile shows stronger structural persistence than peer",
      tone: "positive",
      dimension: "profitability"
    });
  }

  // 4. Structural symmetry (Both strong, neither fragile)
  if (mainStrong && peerStrong && !mainFragile && !peerFragile) {
    contrasts.push({
      id: "structural-symmetry",
      text: "Both companies exhibit comparable structural consistency",
      tone: "neutral",
      dimension: "profitability"
    });
  }

  return contrasts.slice(0, 2);
}
