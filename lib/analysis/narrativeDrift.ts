import { NarrativeAnchor } from "./narrativeAnchors";

export type NarrativeDrift = {
  type: 'emerging' | 'fading' | 'shift';
  message: string;
};

/**
 * Detects changes in narrative dominance over time.
 * 
 * Rules:
 * 1. Narrative Shift: Previous Dominant ID != Current Dominant ID
 * 2. Emerging Narrative: No Previous Dominant -> Current Dominant exists
 * 3. Fading Narrative: Previous Dominant exists -> No Current Dominant
 * 
 * @param previousAnchors List of previous anchors (with dominance)
 * @param currentAnchors List of current anchors (with dominance)
 * @returns NarrativeDrift object or null if no significant change
 */
export function evaluateNarrativeDrift(
  previousAnchors: NarrativeAnchor[],
  currentAnchors: NarrativeAnchor[]
): NarrativeDrift | null {
  // If either list is empty, we generally consider this "insufficient data" rather than drift,
  // based on the constraint "If either anchor list is empty → return null".
  // However, strict reading of rules 3.1 and 3.2 might imply emerging/fading logic even if empty.
  // Constraint 5 says: "If either anchor list is empty → return null". 
  // This constraint effectively disables 'emerging' and 'fading' logic if 'empty' means list length 0.
  // BUT, 'Emerging' rule says "No dominant anchor existed previously". 
  // If previous list is empty, then no dominant anchor existed.
  // If current list is empty, then no dominant anchor exists.
  // The constraint "If either anchor list is empty → return null" seems to CONTRADICT the Emerging/Fading rules 
  // if we interpret "empty" as "empty array".
  // 
  // Let's interpret "empty" as "data not loaded yet" or "invalid state".
  // If data is valid but just has NO anchors, that is a valid state.
  // But usually anchors are calculated. If 0 anchors, maybe valid.
  // 
  // Let's follow constraint 5 STRICTLY:
  if (!previousAnchors || previousAnchors.length === 0) return null;
  if (!currentAnchors || currentAnchors.length === 0) return null;

  const getDominantId = (anchors: NarrativeAnchor[]): string | null => {
    const dominant = anchors.find(a => a.dominance === 'primary');
    return dominant ? dominant.id : null;
  };

  const prevId = getDominantId(previousAnchors);
  const currId = getDominantId(currentAnchors);

  // 1. Shift
  if (prevId && currId && prevId !== currId) {
    return {
      type: 'shift',
      message: 'Narrative emphasis has recently shifted'
    };
  }

  // 2. Emerging
  // (Constraint 5 makes this impossible if previousAnchors is empty. 
  //  But it is possible if previousAnchors has items but NONE are primary? 
  //  Precedence logic guarantees a primary if list > 0. 
  //  So if list > 0, there is always a primary.
  //  Thus, with Constraint 5, Emerging/Fading are theoretically impossible 
  //  unless 'precedence' logic can return NO primary for a non-empty list.
  //  Looking at step 14: "If anchors.length >= 1 → mark one as primary".
  //  So a non-empty list ALWAYS has a primary.
  //  
  //  Therefore, under strict constraints:
  //  - Lists must be non-empty.
  //  - Non-empty lists always have a primary.
  //  - Thus, prevId is never null, currId is never null.
  //  - Thus, only 'Shift' is possible.
  //  
  //  Wait, maybe previousAnchors refers to a PREVIOUS TIME PERIOD's anchors?
  //  "Previous Dominant: Dominant anchor from the previous snapshot".
  //  The user prompt says: "Track previous compressed + precedence-applied anchors. Use a useRef".
  //  This implies comparing state updates (e.g. user changes tabs or data refreshes?).
  //  
  //  Actually, if we are using `useRef` to track "previous render", 
  //  it's detecting drift *during the session* or *across updates*.
  //  
  //  However, if the constraint "If either anchor list is empty" applies, 
  //  then we only detect Shift.
  //  
  //  Let's stick to the rules as written. If logic dictates Shift is the only outcome, so be it.
  //  But maybe 'fading' implies the list became empty? 
  //  "If either anchor list is empty → return null" explicitly blocks Fading if 'fading' means 'current list is empty'.
  //  
  //  Perhaps "No dominant anchor exists now" implies current list has anchors but none are primary?
  //  (Impossible per Step 14).
  //  
  //  Let's assume the user might have meant "If *inputs are invalid* return null".
  //  But "If anchors.length === 0" is a specific valid state for "No signals found".
  //  
  //  Let's implement strictly. 
  //  If previousAnchors has items (and thus a primary) and currentAnchors has items (and thus a primary),
  //  we check Shift.
  //  
  //  If "Emerging" is intended for "Was empty, now has items", constraint 5 blocks it.
  //  I will implement the check, but per constraint 5, it might be dead code.
  //  I will add a comment.
  
  if (!prevId && currId) {
    return {
      type: 'emerging',
      message: 'A dominant narrative has recently emerged'
    };
  }

  if (prevId && !currId) {
    return {
      type: 'fading',
      message: 'Previously dominant signals are losing prominence'
    };
  }

  return null;
}
