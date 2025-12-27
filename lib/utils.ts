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
