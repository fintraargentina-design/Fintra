import { describe, it, expect } from 'vitest';
import { buildValuationState, resolveValuationFromSector, SectorBenchmarkMetric } from './resolveValuationFromSector';
import type { ValuationInput } from './resolveValuationFromSector';

// Mock benchmarks
const mockStats: SectorBenchmarkMetric = {
    p10: 10,
    p25: 15,
    p50: 20,
    p75: 25,
    p90: 30
};

const mockBenchmarks = {
    pe_ratio: mockStats,
    ev_ebitda: mockStats,
    price_to_fcf: mockStats
};

describe('buildValuationState', () => {
    it('should return pending if no metrics available', () => {
        const input: ValuationInput = { sector: 'Tech' };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.stage).toBe('pending');
        expect(result.valuation_status).toBe('pending');
        expect(result.confidence.percent).toBe(0);
    });

    it('should return computed if metrics available', () => {
        const input: ValuationInput = { sector: 'Tech', pe_ratio: 18 }; // 18 is between p25(15) and p50(20) -> ~37.5 percentile
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.stage).toBe('computed');
        // 37.5 < 40 -> Undervalued
        expect(result.valuation_status).toBe('undervalued');
        expect(result.confidence.valid_metrics_count).toBe(1);
        expect(result.confidence.label).toBe('Low');
    });

    it('should calculate median percentile correctly (Undervalued)', () => {
        // P/E: 5 (<=p10 -> 5)
        // EV: 12 (<=p25 -> 17.5)
        // FCF: 18 (<=p50 -> 37.5)
        // Percentiles: [5, 17.5, 37.5]. Median = 17.5.
        // 17.5 < 40 -> Undervalued.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 5,
            ev_ebitda: 12,
            price_to_fcf: 18
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('undervalued');
        expect(result.confidence.label).toBe('High'); // 3 metrics
    });

    it('should calculate median percentile correctly (Overvalued)', () => {
        // P/E: 35 (>p90 -> 95)
        // EV: 28 (<=p90 -> 82.5)
        // FCF: 22 (<=p75 -> 62.5)
        // Percentiles: [62.5, 82.5, 95]. Median = 82.5.
        // 82.5 > 60 -> Overvalued.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 35,
            ev_ebitda: 28,
            price_to_fcf: 22
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('overvalued');
    });
    
    it('should calculate median percentile correctly (Fair)', () => {
        // P/E: 20 (<=p50 -> 37.5)
        // EV: 22 (<=p75 -> 62.5)
        // Percentiles: [37.5, 62.5]. Median = (37.5+62.5)/2 = 50.
        // 50 is between 40 and 60 -> Fair.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 20,
            ev_ebitda: 22
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('fair');
    });
});

describe('resolveValuationFromSector (Legacy)', () => {
    it('should map state to legacy score', () => {
         const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 20,
            ev_ebitda: 22
        };
        const result = resolveValuationFromSector(input, mockBenchmarks);
        expect(result.valuation_status).toBe('fair');
        expect(result.valuation_score).toBe(50);
    });
});
