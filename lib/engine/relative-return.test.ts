import { describe, it, expect } from 'vitest';
import {
  calculateRelativeReturn,
  type RelativeReturnTimeline
} from './relative-return';

describe('Relative Return Engine', () => {
  it('returns null score when no usable windows', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': null,
      '3Y': null,
      '5Y': null
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it('identifies consistent outperformance across all windows', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': { asset_return: 15, benchmark_return: 8, asset_max_drawdown: 25, benchmark_max_drawdown: 22 },
      '3Y': { asset_return: 40, benchmark_return: 25, asset_max_drawdown: 35, benchmark_max_drawdown: 30 },
      '5Y': { asset_return: 90, benchmark_return: 60, asset_max_drawdown: 45, benchmark_max_drawdown: 40 }
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).not.toBeNull();
    expect(result.band).toBe('outperformer');
    expect(result.confidence).not.toBeNull();
    expect((result.confidence as number)).toBeGreaterThan(40);
  });

  it('identifies consistent underperformance across all windows', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': { asset_return: -5, benchmark_return: 2 },
      '3Y': { asset_return: 5, benchmark_return: 20 },
      '5Y': { asset_return: 20, benchmark_return: 50 }
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).not.toBeNull();
    expect(result.band).toBe('underperformer');
  });

  it('treats mixed alpha signs as neutral performance', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': { asset_return: 10, benchmark_return: 8 }, // small outperformance
      '3Y': { asset_return: 20, benchmark_return: 22 }, // slight underperformance
      '5Y': { asset_return: 45, benchmark_return: 45 }  // equal
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).not.toBeNull();
    expect(result.band).toBe('neutral');
  });

  it('applies drawdown penalty when asset drawdown significantly exceeds benchmark', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': {
        asset_return: 15,
        benchmark_return: 10,
        asset_max_drawdown: 40,
        benchmark_max_drawdown: 20
      },
      '3Y': {
        asset_return: 35,
        benchmark_return: 25,
        asset_max_drawdown: 50,
        benchmark_max_drawdown: 30
      },
      '5Y': null
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).not.toBeNull();
    expect((result.components.drawdown_penalty as number)).toBeGreaterThan(0);
    expect(result.band === 'neutral' || result.band === 'underperformer').toBeTruthy();
  });

  it('handles single-window data with neutral consistency', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': { asset_return: 12, benchmark_return: 10 },
      '3Y': null,
      '5Y': null
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.score).not.toBeNull();
    expect(result.components.consistency_score).toBe(50);
  });

  it('reduces confidence when only one window is available', () => {
    const timeline: RelativeReturnTimeline = {
      '1Y': { asset_return: 12, benchmark_return: 10 },
      '3Y': null,
      '5Y': null
    };

    const result = calculateRelativeReturn(timeline);
    expect(result.confidence).not.toBeNull();
    expect((result.confidence as number)).toBeLessThan(60);
  });
});

