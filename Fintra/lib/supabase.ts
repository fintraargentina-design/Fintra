import { createClient } from '@supabase/supabase-js'

// Configuración del cliente Supabase
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);



// Función para registrar una búsqueda
export async function registerStockSearch(symbol: string) {
  try {
    // Registrar búsqueda
    const { data: existingData, error: selectError } = await supabase
      .from('busquedas_acciones')
      .select('symbol, busquedas')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (existingData) {
      // Actualizar contador existente
      const { error: updateError } = await supabase
        .from('busquedas_acciones')
        .update({ 
          busquedas: existingData.busquedas + 1,
          ultima_busqueda: new Date().toISOString()
        })
        .eq('symbol', symbol.toUpperCase());
    } else {
      // Crear nuevo registro
      const { error: insertError } = await supabase
        .from('busquedas_acciones')
        .insert({
          symbol: symbol.toUpperCase(),
          busquedas: 1,
          ultima_busqueda: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('Error in registerStockSearch:', error);
  }
}

// Guardar selección de periodo y fecha de actualización
export async function savePeriodSelection(symbol: string, period: string, updatedAt: string) {
  try {
    const payload = { symbol: symbol.toUpperCase(), period, updated_at: updatedAt };
    const { error } = await supabase
      .from('periodos_accion')
      .upsert(payload, { onConflict: 'symbol' });
    if (error) console.warn('[savePeriodSelection] Supabase error:', error.message);
  } catch (e: any) {
    console.warn('[savePeriodSelection] error:', e?.message || e);
  }
}
