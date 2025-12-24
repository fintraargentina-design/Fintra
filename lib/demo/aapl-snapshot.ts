import { FgosResult } from '@/lib/engine/types';

export const MOCK_AAPL_SNAPSHOT: FgosResult = {
  ticker: 'AAPL',
  fgos_score: 88,
  fgos_breakdown: {
    growth: 80,
    profitability: 95, // High
    efficiency: 92,    // High
    solvency: 85,
    moat: 88,
    sentiment: 70
  },
  valuation_status: 'Overvalued', // As requested
  ecosystem_score: 75,
  ecosystem_details: {
    score: 75,
    summary: "Fuerte integración vertical",
    suppliers: [
      { name: "TSMC", risk: "Low" },
      { name: "Foxconn", risk: "Medium" },
      { name: "Samsung Display", risk: "Low" }
    ],
    clients: [
      { name: "Consumers (High-End)", risk: "Low" },
      { name: "Enterprises", risk: "Low" },
      { name: "App Store Devs", risk: "Medium" }
    ]
  },
  calculated_at: new Date().toISOString(),
  price: 220.50
};
