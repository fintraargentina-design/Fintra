import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getHeatmapColor(value: number): string {
  if (value > 0) {
    if (value < 5) return "#001A00"; // Movimiento positivo marginal
    if (value < 15) return "#003300"; // Subida leve
    if (value < 30) return "#004D00"; // Subida moderada
    if (value < 50) return "#006600"; // Subida fuerte
    return "#008000"; // Subida muy fuerte
  } else if (value < 0) {
    if (value > -5) return "#1A0000"; // Movimiento negativo marginal
    if (value > -15) return "#330000"; // Bajada leve
    if (value > -30) return "#4D0000"; // Bajada moderada
    if (value > -50) return "#660000"; // Bajada fuerte
    return "#800000"; // Bajada muy fuerte
  }
  return "transparent";
}

/**
 * Verifica si una fecha es anterior a X días atrás o es inválida.
 * @param dateString Fecha en formato string (ISO) o Date
 * @param days Número de días de validez (default 30)
 * @returns true si la data es vieja (stale) o inválida
 */
export function isDataStale(dateString?: string | Date | null, days: number = 30): boolean {
  if (!dateString) return true;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return true; // Fecha inválida
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return diffDays > days;
}

export function formatMarketCap(val: number): string {
  if (!val) return '-';
  if (val >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  return val.toFixed(0);
}
