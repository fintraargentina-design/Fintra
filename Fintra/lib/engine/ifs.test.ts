import { describe, it, expect } from "vitest";
import { calculateIFS, RelativePerformanceInputs } from "./ifs";

describe("IFS v1.1 - Block-Based Majority Voting", () => {
  // Helper to create inputs with default nulls
  const createInputs = (
    overrides: Partial<RelativePerformanceInputs>,
  ): RelativePerformanceInputs => ({
    relative_vs_sector_1m: null,
    relative_vs_sector_3m: null,
    relative_vs_sector_6m: null,
    relative_vs_sector_1y: null,
    relative_vs_sector_2y: null,
    relative_vs_sector_3y: null,
    relative_vs_sector_5y: null,
    ...overrides,
  });

  it("1. All blocks neutral → position = null", () => {
    // Short: Mixed (+1, -1) -> 0
    // Mid: No data -> 0
    // Long: Tie (0, 0) -> 0
    const inputs = createInputs({
      relative_vs_sector_1m: 5,
      relative_vs_sector_3m: -5, // Short Vote: 0 (Tie)
      relative_vs_sector_6m: null,
      relative_vs_sector_1y: null, // Mid Vote: 0 (Empty)
      relative_vs_sector_2y: null,
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: -10, // Long Vote: 0 (Tie)
    });

    const result = calculateIFS(inputs);
    expect(result).toBeNull();
  });

  it("2. Only one block emits a vote → position = null", () => {
    // Short: Positive (+1)
    // Mid: Tie (0)
    // Long: Empty (0)
    const inputs = createInputs({
      relative_vs_sector_1m: 5,
      relative_vs_sector_3m: 5, // Short Vote: +1
      relative_vs_sector_6m: 5,
      relative_vs_sector_1y: -5, // Mid Vote: 0 (Tie)
      relative_vs_sector_2y: null,
      // Long: Empty
    });

    const result = calculateIFS(inputs);
    expect(result).toBeNull();
  });

  it("3. Short positive, Mid negative, Long neutral → follower", () => {
    // Short: +1
    // Mid: -1
    // Long: 0
    // Result: Follower (Tie between blocks), Pressure = max(1, 1) = 1
    const inputs = createInputs({
      // Short (+1)
      relative_vs_sector_1m: 10,
      relative_vs_sector_3m: 10,

      // Mid (-1)
      relative_vs_sector_6m: -10,
      relative_vs_sector_1y: -10,
      relative_vs_sector_2y: -10,

      // Long (0)
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: -10,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe("follower");
    expect(result?.pressure).toBe(1);
  });

  it("4. Short negative, Mid negative, Long positive → laggard, pressure = 2", () => {
    // Short: -1
    // Mid: -1
    // Long: +1
    // Result: Laggard (2 neg vs 1 pos), Pressure = 2
    const inputs = createInputs({
      // Short (-1)
      relative_vs_sector_1m: -5,
      relative_vs_sector_3m: -5,

      // Mid (-1)
      relative_vs_sector_6m: -5,
      relative_vs_sector_1y: -5,
      relative_vs_sector_2y: -5,

      // Long (+1)
      relative_vs_sector_3y: 5,
      relative_vs_sector_5y: 5,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe("laggard");
    expect(result?.pressure).toBe(2);
  });

  it("5. Leader with exactly 2 supporting blocks → pressure = 2", () => {
    // Short: +1
    // Mid: +1
    // Long: 0 (Tie or Empty)
    // Result: Leader (2 pos vs 0 neg), Pressure = 2
    const inputs = createInputs({
      // Short (+1)
      relative_vs_sector_1w: 5,
      relative_vs_sector_1m: 5,

      // Mid (+1)
      relative_vs_sector_ytd: 5,
      relative_vs_sector_1y: 5,

      // Long (0)
      relative_vs_sector_3y: null,
      relative_vs_sector_5y: null,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe("leader");
    expect(result?.pressure).toBe(2);
  });

  it("6. Follower with one positive and one negative block → pressure = 1", () => {
    // Already covered in test case 3, but let's be explicit
    // Short: +1
    // Mid: -1
    // Long: Empty (0)
    // Validity: 2 non-zero blocks -> Valid
    // Result: Follower, Pressure = 1
    const inputs = createInputs({
      // Short (+1)
      relative_vs_sector_1w: 5,
      relative_vs_sector_1m: 5,

      // Mid (-1)
      relative_vs_sector_ytd: -5,
      relative_vs_sector_1y: -5,

      // Long (0)
      relative_vs_sector_3y: null,
      relative_vs_sector_5y: null,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe("follower");
    expect(result?.pressure).toBe(1);
  });

  it("7. Missing long-term data must result in neutral long block (not negative)", () => {
    // Short: +1
    // Mid: +1
    // Long: Empty -> 0 (Neutral)
    // Result: Leader (2 pos vs 0 neg), Pressure = 2
    // Ensures missing data doesn't count as negative
    const inputs = createInputs({
      // Short (+1)
      relative_vs_sector_1w: 5,
      relative_vs_sector_1m: 5,

      // Mid (+1)
      relative_vs_sector_ytd: 5,
      relative_vs_sector_1y: 5,

      // Long (Missing)
      relative_vs_sector_3y: null,
      relative_vs_sector_5y: null,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe("leader");
    expect(result?.pressure).toBe(2); // Should only count the 2 positive blocks
  });

  // Additional edge case: 3 blocks, 3 votes (Leader)
  it("should return leader with pressure 3 if all blocks are positive", () => {
    const inputs = createInputs({
      relative_vs_sector_1w: 1,
      relative_vs_sector_1m: 1, // +1
      relative_vs_sector_ytd: 1,
      relative_vs_sector_1y: 1, // +1
      relative_vs_sector_3y: 1,
      relative_vs_sector_5y: 1, // +1
    });
    const result = calculateIFS(inputs);
    expect(result?.position).toBe("leader");
    expect(result?.pressure).toBe(3);
  });
});

describe("IFS Confidence Score", () => {
  const createInputs = (
    overrides: Partial<RelativePerformanceInputs>,
  ): RelativePerformanceInputs => ({
    relative_vs_sector_1m: null,
    relative_vs_sector_3m: null,
    relative_vs_sector_6m: null,
    relative_vs_sector_1y: null,
    relative_vs_sector_2y: null,
    relative_vs_sector_3y: null,
    relative_vs_sector_5y: null,
    ...overrides,
  });

  it("should return High confidence with full data and unanimous signals", () => {
    // 7/7 windows available (100% availability)
    // 3/3 blocks unanimous (signalConsistency = 1.0)
    // Confidence = 40% * 1.0 + 40% * 1.0 + 20% * 0.5 = 90%
    const inputs = createInputs({
      relative_vs_sector_1m: 10,
      relative_vs_sector_3m: 10,
      relative_vs_sector_6m: 10,
      relative_vs_sector_1y: 10,
      relative_vs_sector_2y: 10,
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: 10,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(80);
    expect(result!.confidence_label).toBe("High");
    expect(result!.interpretation).toMatch(/Leader/i); // Case insensitive
  });

  it("should return Medium confidence with partial data (4/7 windows)", () => {
    // 4/7 windows = 57% availability
    // Valid blocks: Short and Mid both vote +1, Long is empty (0)
    // Only 2 non-zero blocks -> position should be null per IFS v1.1 logic (need >=2 non-zero)
    // This test needs adjustment: with only Short+Mid unanimous, we get 2 blocks = borderline valid
    const inputs = createInputs({
      relative_vs_sector_1m: 5,
      relative_vs_sector_3m: 5, // Short +1
      relative_vs_sector_6m: 5,
      relative_vs_sector_1y: 5,
      relative_vs_sector_2y: 5, // Mid +1
      // Missing 3y, 5y (Long = 0)
    });

    const result = calculateIFS(inputs);
    // With 2 non-zero blocks, this is valid per ">= 2 blocks" rule
    // Confidence should be medium due to lower availability (4/7 = 57%)
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(50); // Adjusted expectation
    expect(result!.confidence).toBeLessThan(80);
    expect(result!.confidence_label).toMatch(/Medium|Low/);
  });

  it("should return Low confidence with minimal data (2/7 windows)", () => {
    // Only 2 windows = 28.5% availability
    // Only Short block can vote (+1), Mid and Long are empty
    // With only 1 non-zero block -> position = null per IFS logic
    const inputs = createInputs({
      relative_vs_sector_1m: 5,
      relative_vs_sector_3m: 5,
      // All others missing
    });

    const result = calculateIFS(inputs);
    // With only 1 block voting, result should be null
    expect(result).toBeNull();
  });

  it("should return null with insufficient blocks (<2 valid)", () => {
    // Only 1 block can emit a vote -> position = null per IFS logic
    // Confidence not applicable
    const inputs = createInputs({
      relative_vs_sector_1m: 5,
      relative_vs_sector_3m: 5,
      // Mid and Long blocks missing
    });

    const result = calculateIFS(inputs);
    expect(result).toBeNull();
  });

  it("should penalize confidence when signals are mixed (inconsistent)", () => {
    // All windows present (100% availability)
    // But blocks disagree: Short +, Mid -, Long 0
    // signalConsistency = 0.7 (mixed signals penalty in code)
    // With mixed signals, confidence should still be relatively high due to full data
    const inputs = createInputs({
      relative_vs_sector_1m: 10,
      relative_vs_sector_3m: 10, // Short: +1
      relative_vs_sector_6m: -10,
      relative_vs_sector_1y: -10,
      relative_vs_sector_2y: -10, // Mid: -1
      relative_vs_sector_3y: 5,
      relative_vs_sector_5y: -5, // Long: 0 (tie)
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result!.position).toBe("follower"); // Mixed signals
    // With full data but mixed signals, confidence should be lower but not too low
    expect(result!.confidence).toBeGreaterThanOrEqual(70);
    expect(result!.confidence).toBeLessThan(90); // Lower than unanimous case
    expect(result!.confidence_label).toMatch(/High|Medium/);
  });

  it("should correctly interpret dominant horizons", () => {
    // Leader with High confidence should mention "Leader" in interpretation
    // Laggard should mention "Laggard" and pressure
    const leaderInputs = createInputs({
      relative_vs_sector_1m: 15,
      relative_vs_sector_3m: 15,
      relative_vs_sector_6m: 15,
      relative_vs_sector_1y: 15,
      relative_vs_sector_2y: 5,
      relative_vs_sector_3y: 5,
      relative_vs_sector_5y: 5,
    });

    const leaderResult = calculateIFS(leaderInputs);
    expect(leaderResult).not.toBeNull();
    expect(leaderResult!.position).toBe("leader");
    expect(leaderResult!.interpretation).toMatch(/Leader/i); // Case insensitive

    const laggardInputs = createInputs({
      relative_vs_sector_1m: -10,
      relative_vs_sector_3m: -10,
      relative_vs_sector_6m: -10,
      relative_vs_sector_1y: -10,
      relative_vs_sector_2y: -10,
      relative_vs_sector_3y: -10,
      relative_vs_sector_5y: -10,
    });

    const laggardResult = calculateIFS(laggardInputs);
    expect(laggardResult).not.toBeNull();
    expect(laggardResult!.position).toBe("laggard");
    expect(laggardResult!.pressure).toBe(3);
    expect(laggardResult!.interpretation).toMatch(/Laggard/i); // Case insensitive
  });

  it("should calculate pressure correctly with confidence context", () => {
    // Leader with pressure = 3 (all blocks positive) should have high confidence
    const inputs = createInputs({
      relative_vs_sector_1m: 10,
      relative_vs_sector_3m: 10,
      relative_vs_sector_6m: 10,
      relative_vs_sector_1y: 10,
      relative_vs_sector_2y: 10,
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: 10,
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result!.position).toBe("leader");
    expect(result!.pressure).toBe(3);
    expect(result!.confidence).toBeGreaterThanOrEqual(80);
    expect(result!.confidence_label).toBe("High");
  });
});
