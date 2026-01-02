import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializar cliente de Supabase con permisos de Admin (Service Role)
// Asegúrate de tener estas variables en tu archivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Tipos para los datos del ecosistema
interface EcoItem {
  id: string;
  n: string; // nombre
  ehs: number; // Ecosystem Health Score
  [key: string]: any; // Permitir otras propiedades
}

interface WebhookPayload {
  mainTicker: string;
  suppliers: EcoItem[];
  clients: EcoItem[];
  report: string;
}

/**
 * Calcula el Ecosystem Score promedio basado en los proveedores.
 * Si no hay proveedores, devuelve 50 (neutral).
 */
function calculateEcosystemScore(suppliers: EcoItem[]): number {
  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    return 50;
  }

  const totalEhs = suppliers.reduce((sum, item) => sum + (Number(item.ehs) || 50), 0);
  return Math.round(totalEhs / suppliers.length);
}

export async function POST(req: Request) {
  try {
    const body: WebhookPayload = await req.json();
    const { mainTicker, suppliers, clients, report } = body;

    // Validación básica
    if (!supabase) {
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta (Supabase Keys faltantes)' },
        { status: 500 }
      );
    }

    if (!mainTicker) {
      return NextResponse.json(
        { error: 'Falta el campo mainTicker en el cuerpo de la solicitud' },
        { status: 400 }
      );
    }

    // Calcular Score
    const ecosystemScore = calculateEcosystemScore(suppliers);

    // Actualizar en Supabase
    // Usamos fintra_snapshots y filtramos por ticker
    const { data, error } = await supabase
      .from('fintra_snapshots')
      .update({
        ecosystem_data: { suppliers, clients },
        ecosystem_report: report,
        ecosystem_score: ecosystemScore,
        updated_at: new Date().toISOString(), // Asumiendo que existe, si no, Supabase lo ignorará si no está en schema o lanzará error según config
      })
      .eq('ticker', mainTicker)
      .select();

    if (error) {
      console.error('Error actualizando Supabase:', error);
      return NextResponse.json(
        { error: 'Error al actualizar la base de datos', details: error.message },
        { status: 500 }
      );
    }

    // Verificar si se actualizó algún registro
    if (!data || data.length === 0) {
       console.warn(`No se encontró el ticker ${mainTicker} para actualizar.`);
       // Podríamos devolver 404, pero para un webhook a veces es mejor 200 con mensaje informativo
       // o 404 si queremos que el emisor sepa que falló la referencia.
       return NextResponse.json(
         { message: `Ticker ${mainTicker} no encontrado. No se realizó actualización.`, success: false },
         { status: 404 }
       );
    }

    return NextResponse.json({
      success: true,
      message: 'Datos del ecosistema actualizados correctamente',
      data: {
        ticker: mainTicker,
        score: ecosystemScore,
        updated: true
      }
    });

  } catch (err: any) {
    console.error('Error procesando el webhook:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: err.message },
      { status: 500 }
    );
  }
}
