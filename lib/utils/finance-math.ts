
import { OHLC } from "@/lib/fmp/types";

/**
 * Alinea múltiples series de tiempo (OHLC) a un eje de fechas común.
 * Usa la serie "primary" (el ticker principal) como referencia para las filas devueltas,
 * pero itera sobre la UNIÓN de todas las fechas para asegurar un Forward Fill correcto de los pares.
 */
export function alignSeries(
  primarySeries: OHLC[], 
  otherSeriesList: { id: string; data: OHLC[] }[]
): { date: string; [key: string]: number | string | null }[] {
  if (!primarySeries || primarySeries.length === 0) return [];

  // 1. Crear mapas rápidos (Date String -> Close Price)
  const primaryMap = new Map(primarySeries.map(d => [d.date.split('T')[0], d.close]));
  
  const otherMaps = otherSeriesList.map(s => ({
    id: s.id,
    map: new Map(s.data.map(d => [d.date.split('T')[0], d.close]))
  }));

  // 2. Obtener la UNIÓN de todas las fechas para asegurar continuidad en el estado (Last Known Value)
  const allDatesSet = new Set<string>(primarySeries.map(d => d.date.split('T')[0]));
  otherSeriesList.forEach(s => {
      s.data.forEach(d => allDatesSet.add(d.date.split('T')[0]));
  });

  const sortedAllDates = Array.from(allDatesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const result: { date: string; [key: string]: number | string | null }[] = [];

  // 3. Variables de Estado para Forward Fill
  const lastOthers: Record<string, number> = {};
  otherSeriesList.forEach(s => lastOthers[s.id] = NaN);

  // 4. Iterar sobre TODAS las fechas cronológicamente
  for (const date of sortedAllDates) {
      // Actualizar estado de pares (Peers)
      for (const other of otherMaps) {
          const oVal = other.map.get(date);
          if (oVal !== undefined && oVal !== null) {
              lastOthers[other.id] = oVal;
          }
      }

      // Solo generamos fila si es una fecha válida para el Primary
      // (Mantenemos el eje X fiel al activo principal, pero con datos de pares actualizados correctamente)
      if (primaryMap.has(date)) {
          const pVal = primaryMap.get(date);
          // Nota: Si pVal es 0 o null, lo tratamos como tal.
          
          const row: any = { date };
          row['primary'] = pVal;

          // Rellenar pares con su último valor conocido (Forward Fill)
          for (const other of otherMaps) {
              const val = lastOthers[other.id];
              // Si es NaN, significa que el par aún no empezó a cotizar o no hay datos previos
              row[other.id] = isNaN(val) ? null : val;
          }

          result.push(row);
      }
  }

  return result;
}

/**
 * Normaliza los precios a Base 0% (Retorno Acumulado).
 * El primer punto de datos válido de cada serie se convierte en 0%.
 * Fórmula: ((Precio_Actual - Precio_Base) / Precio_Base) * 100
 */
export function normalizeRebase100(
    alignedData: { date: string; [key: string]: number | string | null }[],
    fields: string[] 
): { date: string; [key: string]: number | string | null }[] {
    if (!alignedData || alignedData.length === 0) return [];

    const baseValues: Record<string, number> = {};

    // Encontrar base para cada campo independientemente
    for (const field of fields) {
        const validRow = alignedData.find(row => {
            const val = row[field];
            return typeof val === 'number' && !isNaN(val) && val !== 0;
        });
        if (validRow) {
            baseValues[field] = validRow[field] as number;
        }
    }

    return alignedData.map(row => {
        const newRow: any = { date: row.date };
        for (const field of fields) {
            const val = row[field];
            const base = baseValues[field];
            
            if (typeof val === 'number' && !isNaN(val) && base) {
                newRow[field] = ((val - base) / base) * 100;
            } else {
                newRow[field] = null;
            }
        }
        return newRow;
    });
}

/**
 * Calcula el Drawdown (Caída desde el máximo histórico en la ventana actual).
 * Devuelve array alineado con la entrada.
 */
export function calculateDrawdown(
    prices: (number | null | undefined)[]
): (number | null)[] {
    let peak = -Infinity;
    
    return prices.map(price => {
        if (price === null || price === undefined || isNaN(price)) {
            return null; // Mantener hueco
        }

        if (price > peak) peak = price;
        
        // Evitar división por cero si el precio es 0 (no debería en stocks, pero por seguridad)
        if (peak === 0) return 0;

        // Drawdown es siempre <= 0
        return ((price - peak) / peak) * 100;
    });
}

// Alias para mantener compatibilidad si se usa en otros lados con otro nombre, 
// pero recomendamos usar normalizeRebase100 unificado.
export const normalizeRebase100Aligned = normalizeRebase100;
