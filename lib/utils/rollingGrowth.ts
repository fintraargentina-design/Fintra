export function rollingFYGrowth(
  rows: any[],
  field: string,
  years = 5
): number | null {
  if (!rows?.length) return null;

  const sorted = [...rows]
    .filter(r => Number.isFinite(Number(r[field])))
    .sort((a, b) => Number(b.fiscalYear) - Number(a.fiscalYear))
    .slice(0, years);

  if (sorted.length < 3) return null;

  const avg =
    sorted.reduce((sum, r) => sum + Number(r[field]), 0) / sorted.length;

  return Number.isFinite(avg) ? avg : null;
}
