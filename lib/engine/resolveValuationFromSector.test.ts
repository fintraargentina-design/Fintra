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

describe('buildValuationState (Canonical Algorithm)', () => {
    it('should return pending if no metrics available', () => {
        const input: ValuationInput = { sector: 'Tech' };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.stage).toBe('pending');
        expect(result.valuation_status).toBe('pending');
        expect(result.confidence.percent).toBe(0);
    });

    it('should return pending if metrics are invalid (<= 0 or non-finite)', () => {
        const input: ValuationInput = { 
            sector: 'Tech',
            pe_ratio: -5,        // Invalid
            ev_ebitda: 0,        // Invalid
            price_to_fcf: null   // Invalid
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.stage).toBe('pending');
        expect(result.valuation_status).toBe('pending');
        expect(result.confidence.valid_metrics_count).toBe(0);
    });

    it('should return pending if only 1 metric available (Min Threshold 2)', () => {
        const input: ValuationInput = { sector: 'Tech', pe_ratio: 18 }; 
        const result = buildValuationState(input, mockBenchmarks);
        
        expect(result.stage).toBe('pending');
        expect(result.valuation_status).toBe('pending');
        expect(result.confidence.valid_metrics_count).toBe(1);
    });

    it('should return partial/computed if 2 metrics available', () => {
        // PE: 18 -> percentile ~40
        // EV: 18 -> percentile ~40
        // Median(40, 40) = 40 -> cheap_sector
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 18,
            ev_ebitda: 18
        };
        const result = buildValuationState(input, mockBenchmarks);
        
        expect(result.stage).toBe('partial');
        expect(result.valuation_status).toBe('cheap_sector');
        expect(result.confidence.valid_metrics_count).toBe(2);
    });

    it('should calculate median correctly (All Cheap)', () => {
        // P/E: 5 -> percentile ~0
        // EV: 12 -> percentile ~16
        // FCF: 18 -> percentile ~40
        // Median(0, 16, 40) = 16.
        // 16 <= 20 -> very_cheap_sector.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 5,
            ev_ebitda: 12,
            price_to_fcf: 18
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.stage).toBe('computed');
        expect(result.valuation_status).toBe('very_cheap_sector');
        expect(result.confidence.label).toBe('High'); // 3 metrics
    });

    it('should calculate median correctly (All Expensive)', () => {
        // P/E: 35 -> percentile ~100
        // EV: 28 -> percentile ~84
        // FCF: 22 -> percentile ~60
        // Median(100, 84, 60) = 84.
        // 84 >= 80 -> very_expensive_sector.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 35,
            ev_ebitda: 28,
            price_to_fcf: 22
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('very_expensive_sector');
    });
    
    it('should calculate median correctly (Mixed -> Fair)', () => {
        // P/E: 20 -> percentile 50
        // EV: 22 -> percentile ~60
        // Percentiles: [50, 60].
        // Median: (50 + 60) / 2 = 55.
        // 40 < 55 <= 60 -> fair_sector.
        
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 20,
            ev_ebitda: 22
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('fair_sector');
    });

    it('should handle mixed cheap/expensive signals (Majority Vote)', () => {
        // P/E: 10 -> percentile 10
        // EV: 10 -> percentile 10
        // FCF: 30 -> percentile 90
        // Percentiles: [10, 10, 90]. Median = 10.
        // 10 <= 20 -> very_cheap_sector.

        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 10,
            ev_ebitda: 10,
            price_to_fcf: 30
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.valuation_status).toBe('very_cheap_sector');
    });

    it('should penalize confidence when percentiles are dispersed', () => {
        const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 10,
            ev_ebitda: 30
        };
        const result = buildValuationState(input, mockBenchmarks);
        expect(result.confidence.percent).toBe(35);
        expect(result.confidence.label).toBe('Low');
    });
});

describe('resolveValuationFromSector (Legacy Support)', () => {
    it('should map canonical state to legacy score/status', () => {
         // Fair scenario
         const input: ValuationInput = { 
            sector: 'Tech', 
            pe_ratio: 20,
            ev_ebitda: 22
        };
        const result = resolveValuationFromSector(input, mockBenchmarks);
        
        // Canonical: fair_sector
        // Legacy Map: fair, 50
        expect(result.valuation_status).toBe('fair');
        expect(result.valuation_score).toBe(50);
    });

    it('should map cheap_sector to undervalued/80', () => {
        const input: ValuationInput = { 
           sector: 'Tech', 
           pe_ratio: 18,
           ev_ebitda: 18
       };
       const result = resolveValuationFromSector(input, mockBenchmarks);
       
       expect(result.valuation_status).toBe('undervalued');
       expect(result.valuation_score).toBe(80);
   });
});
