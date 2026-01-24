
import { describe, it, expect } from 'vitest';
import { calculateIFS, RelativePerformanceInputs } from './ifs';

describe('IFS v1.1 - Block-Based Majority Voting', () => {
  // Helper to create inputs with default nulls
  const createInputs = (overrides: Partial<RelativePerformanceInputs>): RelativePerformanceInputs => ({
    relative_vs_sector_1w: null,
    relative_vs_sector_1m: null,
    relative_vs_sector_ytd: null,
    relative_vs_sector_1y: null,
    relative_vs_sector_3y: null,
    relative_vs_sector_5y: null,
    ...overrides
  });

  it('1. All blocks neutral → position = null', () => {
    // Short: Mixed (+1, -1) -> 0
    // Mid: No data -> 0
    // Long: Tie (0, 0) -> 0 (actually 0 is not tie, 0 is positive in some logic? No, >0 is pos, <0 is neg)
    // Let's force ties or empty
    const inputs = createInputs({
      relative_vs_sector_1w: 5,
      relative_vs_sector_1m: -5, // Short Vote: 0 (Tie)
      relative_vs_sector_ytd: null,
      relative_vs_sector_1y: null, // Mid Vote: 0 (Empty)
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: -10 // Long Vote: 0 (Tie)
    });

    const result = calculateIFS(inputs);
    expect(result).toBeNull();
  });

  it('2. Only one block emits a vote → position = null', () => {
    // Short: Positive (+1)
    // Mid: Tie (0)
    // Long: Empty (0)
    const inputs = createInputs({
      relative_vs_sector_1w: 5,
      relative_vs_sector_1m: 5, // Short Vote: +1
      relative_vs_sector_ytd: 5,
      relative_vs_sector_1y: -5, // Mid Vote: 0 (Tie)
      // Long: Empty
    });

    const result = calculateIFS(inputs);
    expect(result).toBeNull();
  });

  it('3. Short positive, Mid negative, Long neutral → follower', () => {
    // Short: +1
    // Mid: -1
    // Long: 0
    // Result: Follower (Tie between blocks), Pressure = max(1, 1) = 1
    const inputs = createInputs({
      // Short (+1)
      relative_vs_sector_1w: 10,
      relative_vs_sector_1m: 10,
      
      // Mid (-1)
      relative_vs_sector_ytd: -10,
      relative_vs_sector_1y: -10,
      
      // Long (0)
      relative_vs_sector_3y: 10,
      relative_vs_sector_5y: -10
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe('follower');
    expect(result?.pressure).toBe(1);
  });

  it('4. Short negative, Mid negative, Long positive → laggard, pressure = 2', () => {
    // Short: -1
    // Mid: -1
    // Long: +1
    // Result: Laggard (2 neg vs 1 pos), Pressure = 2
    const inputs = createInputs({
      // Short (-1)
      relative_vs_sector_1w: -5,
      relative_vs_sector_1m: -5,
      
      // Mid (-1)
      relative_vs_sector_ytd: -5,
      relative_vs_sector_1y: -5,
      
      // Long (+1)
      relative_vs_sector_3y: 5,
      relative_vs_sector_5y: 5
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe('laggard');
    expect(result?.pressure).toBe(2);
  });

  it('5. Leader with exactly 2 supporting blocks → pressure = 2', () => {
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
      relative_vs_sector_5y: null
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe('leader');
    expect(result?.pressure).toBe(2);
  });

  it('6. Follower with one positive and one negative block → pressure = 1', () => {
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
      relative_vs_sector_5y: null
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe('follower');
    expect(result?.pressure).toBe(1);
  });

  it('7. Missing long-term data must result in neutral long block (not negative)', () => {
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
      relative_vs_sector_5y: null
    });

    const result = calculateIFS(inputs);
    expect(result).not.toBeNull();
    expect(result?.position).toBe('leader');
    expect(result?.pressure).toBe(2); // Should only count the 2 positive blocks
  });

  // Additional edge case: 3 blocks, 3 votes (Leader)
  it('should return leader with pressure 3 if all blocks are positive', () => {
    const inputs = createInputs({
      relative_vs_sector_1w: 1, relative_vs_sector_1m: 1,   // +1
      relative_vs_sector_ytd: 1, relative_vs_sector_1y: 1,  // +1
      relative_vs_sector_3y: 1, relative_vs_sector_5y: 1    // +1
    });
    const result = calculateIFS(inputs);
    expect(result?.position).toBe('leader');
    expect(result?.pressure).toBe(3);
  });
});
