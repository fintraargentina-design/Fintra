// Configuración base para todas las APIs de FMP

// Tipos para la configuración
interface ApiParams {
  [key: string]: string | number | boolean | undefined | null;
}

interface DateSortable {
  date?: string;
}

// Variables de entorno con validación de tipos
const API_KEY: string | undefined = process.env.NEXT_PUBLIC_FMP_API_KEY;
const BASE_URL: string | undefined = process.env.NEXT_PUBLIC_FMP_BASE_URL;

if (!API_KEY || !BASE_URL) {
  throw new Error('Las variables NEXT_PUBLIC_FMP_API_KEY y NEXT_PUBLIC_FMP_BASE_URL deben estar configuradas');
}

/**
 * Construye una URL completa para las APIs de FMP
 * @param path - Ruta del endpoint
 * @param params - Parámetros de consulta opcionales
 * @returns URL completa con API key
 */
export function buildUrl(path: string, params: ApiParams = {}): string {
  try {
    const base = (BASE_URL || "").replace(/\/+$/, "");
    const cleanPath = String(path).replace(/^\/+/, "");
    const u = new URL(`${base}/${cleanPath}`);
    
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        u.searchParams.set(k, String(v));
      }
    });
    
    u.searchParams.set('apikey', API_KEY!);
    return u.toString();
  } catch (error) {
    throw new Error(`Error construyendo URL: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Asegura que el valor sea un array
 * @param val - Valor a convertir
 * @returns Array garantizado
 */
export function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [];
}

/**
 * Ordena un array por fecha en orden descendente
 * @param arr - Array de objetos con propiedad date
 * @returns Array ordenado por fecha (más reciente primero)
 */
export function sortByDateDesc<T extends DateSortable>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

// Exportaciones de constantes
export { API_KEY, BASE_URL };

// Tipos exportados para uso en otros archivos
export type { ApiParams, DateSortable };