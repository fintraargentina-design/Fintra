import { Badge } from "@/components/ui/badge";

export const getFgosBandLabel = (score: number) => {
  if (score >= 80) return "Fuerte";
  if (score >= 60) return "Defendable";
  return "Débil";
};

export const getMoatLabel = (marketPosition: any) => {
  if (!marketPosition) return "-";
  // marketPosition can be a string (summary) or an object
  const summary = typeof marketPosition === 'string' ? marketPosition : marketPosition?.summary;
  
  if (!summary) return "-";
  
  const lower = summary.toLowerCase();
  if (lower === 'leader' || lower === 'strong') return "Fuerte";
  if (lower === 'average' || lower === 'defendable') return "Defendable";
  return "Débil";
};

export const getRelativeReturnLabel = (relativeReturn: any) => {
  if (!relativeReturn) return "-";
  // relativeReturn can be object with 'band'
  const band = relativeReturn.band || relativeReturn;
  
  if (!band) return "-";
  
  const lower = String(band).toLowerCase();
  if (lower.includes('outperform') || lower.includes('supera')) return "Supera al benchmark";
  if (lower.includes('neutral') || lower.includes('linea')) return "En línea con el benchmark";
  if (lower.includes('underperform') || lower.includes('debajo')) return "Por debajo del benchmark";
  return "-";
};

export const getStrategicStateLabel = (state: any) => {
  if (!state) return "-";
  const val = typeof state === 'string' ? state : state?.label || state;
  if (!val) return "-";
  
  const lower = String(val).toLowerCase();
  if (lower.includes('aligned') || lower.includes('alineado')) return "Alineado";
  if (lower.includes('tension') || lower.includes('strain')) return "En tensión";
  if (lower.includes('desfasado') || lower.includes('drift')) return "Desfasado";
  return "-";
};

export const getValBadge = (v: string | null | undefined) => {
    if (!v) return <span className="text-gray-500 text-[10px]">-</span>;

    const lowerV = v.toLowerCase();
    if (lowerV.includes("cheap") || lowerV.includes("under") || lowerV.includes("infra")) {
      return (
        <Badge
          className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5 w-30 justify-center whitespace-nowrap"
          variant="outline"
        >
          Barata para el sector
        </Badge>
      );
    }
    if (lowerV.includes("fair") || lowerV.includes("line") || lowerV.includes("justa")) {
      return (
        <Badge
          className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5 w-30 justify-center whitespace-nowrap"
          variant="outline"
        >
          En línea con el sector
        </Badge>
      );
    }
    if (lowerV === "n/a") return <span className="text-gray-500 text-[10px]">-</span>;
    return (
      <Badge
        className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5 w-30 justify-center whitespace-nowrap"
        variant="outline"
      >
        Cara para el sector
      </Badge>
    );
};

// --- Sorting Helpers ---

const getMoatScore = (marketPosition: any): number => {
  if (!marketPosition) return 0;
  const summary = typeof marketPosition === 'string' ? marketPosition : marketPosition?.summary;
  if (!summary) return 0;
  const lower = summary.toLowerCase();
  if (lower === 'leader' || lower === 'strong' || lower === 'fuerte') return 3;
  if (lower === 'average' || lower === 'defendable') return 2;
  return 1;
};

const getValuationScore = (v: string | null | undefined): number => {
  if (!v) return 0;
  const lower = v.toLowerCase();
  if (lower.includes('cheap') || lower.includes('under') || lower.includes('infra')) return 3;
  if (lower.includes('fair') || lower.includes('line') || lower.includes('justa')) return 2;
  return 1; // Cara
};

const getRelativeReturnScore = (rr: any): number => {
  if (!rr) return 0;
  const band = typeof rr === 'string' ? rr : rr?.band || rr;
  if (!band) return 0;
  const lower = String(band).toLowerCase();
  if (lower.includes('outperform') || lower.includes('supera')) return 3;
  if (lower.includes('neutral') || lower.includes('linea')) return 2;
  return 1;
};

const getStrategicStateScore = (ss: any): number => {
  if (!ss) return 0;
  const val = typeof ss === 'string' ? ss : ss?.label || ss;
  if (!val) return 0;
  const lower = String(val).toLowerCase();
  if (lower.includes('aligned') || lower.includes('alineado')) return 3;
  if (lower.includes('tension') || lower.includes('strain')) return 2;
  return 1;
};

export const compareStocks = (a: any, b: any) => {
  // 1. Ranking Sectorial (IFS) DESC
  if ((b.fgos || 0) !== (a.fgos || 0)) {
    return (b.fgos || 0) - (a.fgos || 0);
  }

  // 2. Calidad Fundamental (Band) - Implicit in FGOS, but if same score, same band.

  // 3. Estructura Competitiva (Fuerte > Defendable > Débil)
  const moatA = getMoatScore(a.marketPosition);
  const moatB = getMoatScore(b.marketPosition);
  if (moatB !== moatA) return moatB - moatA;

  // 4. Valuación vs. Sector (Barata > En línea > Cara)
  const valA = getValuationScore(a.valuation);
  const valB = getValuationScore(b.valuation);
  if (valB !== valA) return valB - valA;

  // 5. Resultado Relativo (Supera > En línea > Por debajo)
  const rrA = getRelativeReturnScore(a.relativeReturn);
  const rrB = getRelativeReturnScore(b.relativeReturn);
  if (rrB !== rrA) return rrB - rrA;

  // 6. Estado Estratégico (Alineado > En tensión > Desfasado)
  const ssA = getStrategicStateScore(a.strategicState);
  const ssB = getStrategicStateScore(b.strategicState);
  if (ssB !== ssA) return ssB - ssA;

  return 0;
};
