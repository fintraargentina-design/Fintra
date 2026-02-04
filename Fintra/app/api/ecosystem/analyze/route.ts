import { NextResponse } from 'next/server';
import { getOrAnalysisEcosystem } from '@/lib/services/ecosystem-service';

export const maxDuration = 60; // Permitir hasta 60s para que la IA responda (Vercel Pro)
export const dynamic = 'force-dynamic'; // No cachear estáticamente la respuesta del endpoint

export async function GET(req: Request) {
  // Extraer ticker de searchParams
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const force = searchParams.get('force') === 'true';

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    // Llamar a ecosystemService.getOrAnalysisEcosystem(ticker)
    const result = await getOrAnalysisEcosystem(ticker, force);
    
    // Retornar JSON
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Ecosystem Analyze Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
