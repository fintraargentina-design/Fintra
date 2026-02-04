
export type TimelineResponse = {
  ticker: string;
  currency: string;
  years: {
    year: number;
    tone: "light" | "dark";
    columns: string[];
  }[];
  metrics: {
    key: string;
    label: string;
    unit: string;
    category: string;
    priority: "A" | "B" | "C";
    heatmap: {
      direction: "higher_is_better" | "lower_is_better";
      scale: "relative_row";
    };
    values: {
      [periodLabel: string]: {
        value: number | null;
        display: string | null;
        normalized: number | null;
        period_type: "Q" | "TTM" | "FY" | null;
        period_end_date?: string;
      };
    };
  }[];
};

export type StructuralSignalType = 
  | "structural_profitability"
  | "structural_cash_generation"
  | "episodic_performance"
  | "structural_fragility";

export interface StructuralSignal {
  id: StructuralSignalType;
  strength?: number;
}

/**
 * Evaluates structural consistency signals based on TimelineResponse.
 * Uses only FY data.
 * Max 3 signals returned.
 */
export function evaluateStructuralConsistency(timeline: TimelineResponse): StructuralSignal[] {
  if (!timeline || !timeline.years || !timeline.metrics) return [];

  // 1. Extract FY Columns (sorted descending by year usually, but let's ensure we get the last N years)
  // Timeline years structure: usually [{year: 2024, columns: [...]}, {year: 2023...}]
  // We need to identify which columns are FY.
  
  // Helper to get time series for a metric key
  const getTimeSeries = (metricKeyPart: string): { year: number; value: number }[] => {
    // Find metric by loose key matching
    const metric = timeline.metrics.find(m => 
        m.key.toLowerCase().includes(metricKeyPart.toLowerCase()) || 
        m.label.toLowerCase() === metricKeyPart.toLowerCase()
    );
    
    if (!metric) return [];

    const series: { year: number; value: number }[] = [];
    
    // Iterate over years to find FY columns
    timeline.years.forEach(y => {
        // Find the column that is likely FY. 
        // Usually FY column is just the year string or "2023". 
        // But the prompt says columns are like "2024_Q1". 
        // Wait, the prompt says "period_type: 'FY'".
        
        y.columns.forEach(col => {
            const valObj = metric.values[col];
            if (valObj && valObj.period_type === 'FY' && valObj.value !== null) {
                series.push({ year: y.year, value: valObj.value });
            }
        });
    });

    // Sort by year ascending
    return series.sort((a, b) => a.year - b.year);
  };

  const roicSeries = getTimeSeries('roic');
  const fcfSeries = getTimeSeries('freeCashFlow'); // Check if key is freeCashFlow
  const opMarginSeries = getTimeSeries('operatingProfitMargin') || getTimeSeries('operatingMargin');

  // We need at least some history
  if (roicSeries.length < 3) return [];

  const signals: StructuralSignal[] = [];

  // ---------------------------------------------------------
  // 1. Structural Fragility
  // Trigger: Alternation between positive and negative values. No clear multi-year pattern.
  // ---------------------------------------------------------
  const checkFragility = (series: {value: number}[]) => {
      if (series.length < 4) return false;
      let signFlips = 0;
      for (let i = 1; i < series.length; i++) {
          if ((series[i].value > 0 && series[i-1].value < 0) || (series[i].value < 0 && series[i-1].value > 0)) {
              signFlips++;
          }
      }
      // If flips >= 2 in last 5 years, consider fragile
      return signFlips >= 2;
  };

  const isFragile = checkFragility(roicSeries) || checkFragility(fcfSeries) || checkFragility(opMarginSeries);
  if (isFragile) {
      signals.push({ id: "structural_fragility" });
  }

  // ---------------------------------------------------------
  // 2. Episodic Performance
  // Trigger: High YoY variance in ROIC or Operating Margin. Only 1–2 strong FY surrounded by weak years.
  // ---------------------------------------------------------
  const checkEpisodic = (series: {value: number}[]) => {
      if (series.length < 4) return false;
      
      const values = series.map(s => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Calculate variance/stddev
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // If stdDev is small, not episodic
      if (Math.abs(mean) > 0.01 && stdDev / Math.abs(mean) < 0.3) return false; // Low CV
      
      // Check for "1-2 strong FY surrounded by weak years"
      // Define strong as > mean + 0.5 * stdDev
      const strongThreshold = mean + 0.5 * stdDev;
      const strongYears = values.filter(v => v > strongThreshold).length;
      
      // If only 1 or 2 strong years and we have 4+ years history
      return strongYears >= 1 && strongYears <= 2;
  };

  const isEpisodic = checkEpisodic(roicSeries) || checkEpisodic(opMarginSeries);
  
  if (isEpisodic && !signals.some(s => s.id === "structural_fragility")) {
      signals.push({ id: "episodic_performance" });
  }

  // ---------------------------------------------------------
  // 3. Structural Profitability
  // Trigger: ROIC > 0 in at least 4 of last 5 FY. No extreme collapse (value < 50% of 5y average).
  // ---------------------------------------------------------
  const recentRoic = roicSeries.slice(-5);
  if (recentRoic.length >= 4) {
      const positiveCount = recentRoic.filter(r => r.value > 0).length;
      const meanRoic = recentRoic.reduce((a, b) => a + b.value, 0) / recentRoic.length;
      const latestRoic = recentRoic[recentRoic.length - 1].value;
      
      const noCollapse = latestRoic >= (meanRoic * 0.5);
      
      if (positiveCount >= 4 && noCollapse) {
          signals.push({ id: "structural_profitability" });
      }
  }

  // ---------------------------------------------------------
  // 4. Structural Cash Generation
  // Trigger: Free Cash Flow positive in at least 3 of last 4 FY.
  // ---------------------------------------------------------
  const recentFcf = fcfSeries.slice(-4);
  if (recentFcf.length >= 3) {
      const positiveFcf = recentFcf.filter(r => r.value > 0).length;
      if (positiveFcf >= 3) {
          signals.push({ id: "structural_cash_generation" });
      }
  }

  // Priority Order: fragility > episodic > profitability > cash_generation
  // Sort and limit to 3
  const priorityMap: Record<StructuralSignalType, number> = {
      "structural_fragility": 1,
      "episodic_performance": 2,
      "structural_profitability": 3,
      "structural_cash_generation": 4
  };

  return signals
      .sort((a, b) => priorityMap[a.id] - priorityMap[b.id])
      .slice(0, 3);
}
