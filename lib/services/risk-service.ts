import { MarketRiskPremium, ScreenerItem } from "@/lib/fmp/types";
import { fmp } from "@/lib/fmp/client";
import { getCountryIso } from "@/lib/utils/country-mapping";

export interface SunburstNode {
  name: string;
  value?: number;
  itemStyle?: { color?: string };
  label?: { show?: boolean; rotate?: string | number; color?: string };
  children?: SunburstNode[];
  // Extra data for tooltip
  country?: string;
  riskFreeRate?: number;
  equityRiskPremium?: number;
  totalMarketReturn?: number;
  rating?: string;
}

export function transformRiskDataForSunburst(data: MarketRiskPremium[]): SunburstNode {
  // Group by continent
  const continents: Record<string, MarketRiskPremium[]> = {};

  data.forEach(item => {
    const cont = item.continent || "Other";
    if (!continents[cont]) continents[cont] = [];
    continents[cont].push(item);
  });

  const children: SunburstNode[] = Object.keys(continents).map(continentName => {
    const countries = continents[continentName];
    
    const countryNodes: SunburstNode[] = countries.map(c => {
      // API might return strings, ensure numbers
      const rf = Number(c.riskFreeRate) || 0; 
      const erp = Number(c.totalEquityRiskPremium) || 0;
      const totalReturn = rf + erp;
      
      // Determine color based on ERP (Market Risk Premium)
      // Palette: ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444']
      // Range: 0 - 18
      const getColor = (val: number) => {
          const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
          const stops = [0, 6, 12, 18];
          
          if (val <= stops[0]) return colors[0];
          if (val >= stops[stops.length - 1]) return colors[colors.length - 1];
          
          for (let i = 0; i < stops.length - 1; i++) {
              if (val >= stops[i] && val <= stops[i+1]) {
                  // Simple bucket or interpolation?
                  // Let's use bucket for simplicity matching the visual map blocks often seen, 
                  // or just return the lower bound color for now to ensure consistency.
                  // But visualMap is continuous. Let's return the color of the segment.
                  // Actually, to simulate continuous, we need interpolation, but given no external lib,
                  // we will stick to a granular assignment or just let ECharts handle it if we can.
                  // But since we are manually coloring to fix the parent issue:
                  return colors[i]; // Bucket style
              }
          }
          return colors[0];
      };

      // Helper for linear interpolation of hex colors
      const lerpColor = (a: string, b: string, amount: number) => { 
        const ar = parseInt(a.substring(1, 3), 16), ag = parseInt(a.substring(3, 5), 16), ab = parseInt(a.substring(5, 7), 16);
        const br = parseInt(b.substring(1, 3), 16), bg = parseInt(b.substring(3, 5), 16), bb = parseInt(b.substring(5, 7), 16);
        const rr = Math.round(ar + amount * (br - ar));
        const rg = Math.round(ag + amount * (bg - ag));
        const rb = Math.round(ab + amount * (bb - ab));
        return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
      };

      const getContinuousColor = (val: number) => {
         const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
         const min = 0;
         const max = 18;
         if (val <= min) return colors[0];
         if (val >= max) return colors[3];
         
         const step = (max - min) / 3; // 6
         // 0-6: Blue->Green
         // 6-12: Green->Orange
         // 12-18: Orange->Red
         
         if (val < 6) return lerpColor(colors[0], colors[1], val / 6);
         if (val < 12) return lerpColor(colors[1], colors[2], (val - 6) / 6);
         return lerpColor(colors[2], colors[3], (val - 12) / 6);
      };

      let rating = "Low Risk";
      if (erp >= 5 && erp < 8) rating = "Medium-Low Risk";
      else if (erp >= 8 && erp < 12) rating = "Medium-High Risk";
      else if (erp >= 12) rating = "High Risk";

      return {
        name: c.country,
        value: totalReturn, // Size by Total Return (Rf + ERP)
        country: c.country,
        riskFreeRate: rf,
        equityRiskPremium: erp,
        totalMarketReturn: totalReturn,
        rating,
        itemStyle: {
            color: getContinuousColor(erp)
        }
      };
    });

    // Sort countries by size (Total Return)
    countryNodes.sort((a, b) => (b.value || 0) - (a.value || 0));

    return {
      name: continentName,
      children: countryNodes,
      itemStyle: { color: "#f3f4f6" } // Gray-100 for Continent (Neutral)
    };
  });

  return {
    name: "Global Market Risk",
    children: children,
    // itemStyle: { color: "#ffffff" }
  };
}

export async function getTopStocksByCountry(countryName: string): Promise<ScreenerItem[]> {
  const iso = getCountryIso(countryName);
  if (!iso) {
    console.warn(`[getTopStocksByCountry] No ISO code found for country: ${countryName}`);
    return [];
  }

  try {
    const stocks = await fmp.screener({
      country: iso,
      limit: 50,
      marketCapMoreThan: 200000000,
      isActivelyTrading: true,
    });

    // Sort by Market Cap Desc
    return stocks.sort((a, b) => b.marketCap - a.marketCap);
  } catch (error) {
    console.error(`[getTopStocksByCountry] Error fetching stocks for ${countryName} (${iso}):`, error);
    return [];
  }
}
