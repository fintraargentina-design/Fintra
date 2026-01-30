import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ScenarioContext {
  narrativeRisk: {
    level: 'Bajo' | 'Moderado' | 'Elevado';
    score: number;
    active_rules: string[];
  };
  dominantNarratives: {
    narratives: {
      narrative: string;
      count: number;
      confidence_weight: number;
    }[];
    total_insights: number;
  };
  narrativeBias: {
    bias: 'Positivo' | 'Neutro' | 'Negativo';
    score: number;
    breakdown: {
      positiva: number;
      neutra: number;
      negativa: number;
    };
  };
  sample_size: number;
  window_days: number;
  generated_at: string;
}

interface ScenarioOverviewProps {
  context: ScenarioContext;
}

export default function ScenarioOverview({ context }: ScenarioOverviewProps) {
  // Helper for Risk Colors
  const getRiskStyles = (level: string) => {
    switch (level) {
      case 'Bajo':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20'
        };
      case 'Moderado':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20'
        };
      case 'Elevado':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/20'
        };
      default:
        return {
          text: 'text-zinc-400',
          bg: 'bg-zinc-800',
          border: 'border-zinc-700'
        };
    }
  };

  // Helper for Bias Colors
  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'Positivo':
        return 'text-emerald-400';
      case 'Neutro':
        return 'text-zinc-400';
      case 'Negativo':
        return 'text-rose-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getRiskDescription = (level: string) => {
    switch (level) {
      case 'Bajo':
        return "El volumen de noticias es consistente y no se detectan anomalías estructurales significativas.";
      case 'Moderado':
        return "Se observan ciertas irregularidades en el flujo narrativo o divergencias puntuales.";
      case 'Elevado':
        return "Alta volatilidad narrativa o inconsistencias severas en las señales detectadas.";
      default:
        return "Nivel de riesgo no determinado.";
    }
  };

  const riskStyles = getRiskStyles(context.narrativeRisk.level);
  const biasColor = getBiasColor(context.narrativeBias.bias);

  return (
    <div className="flex flex-col gap-6 w-full p-4">
      
      {/* BLOCK 1 — Riesgo Narrativo */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Riesgo Narrativo
        </h3>
        <div className={`p-4 rounded-lg border ${riskStyles.bg} ${riskStyles.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-lg font-semibold ${riskStyles.text}`}>
              {context.narrativeRisk.level}
            </span>
          </div>
          <p className="text-sm text-zinc-300 mb-3 leading-relaxed">
            {getRiskDescription(context.narrativeRisk.level)}
          </p>
          <div className="pt-3 border-t border-zinc-700/50">
            <p className="text-xs text-zinc-500">
              Analizado sobre {context.sample_size} noticias · Ventana: {context.window_days} días
            </p>
          </div>
        </div>
      </section>

      {/* BLOCK 2 — Narrativa Dominante */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Narrativa Dominante
        </h3>
        <div className="flex flex-col gap-2">
          {context.dominantNarratives.narratives.length > 0 ? (
            context.dominantNarratives.narratives.slice(0, 3).map((item, idx) => (
              <div 
                key={idx} 
                className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between"
              >
                <span className="text-zinc-200 text-sm font-medium">
                  {item.narrative}
                </span>
                {/* Optional: subtle indicator of importance, though strict rules say just label. 
                    User said "Subtle badge or list item". 
                    Let's keep it simple text. */}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg border-dashed">
              <p className="text-sm text-zinc-500 italic">
                No se detecta una narrativa dominante clara en este período.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* BLOCK 3 — Sesgo Narrativo Agregado */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Sesgo Narrativo
        </h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-lg font-semibold ${biasColor}`}>
              {context.narrativeBias.bias}
            </span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Refleja la inclinación general del tono narrativo reciente.
            <br />
            No implica una predicción de mercado.
          </p>
        </div>
      </section>

    </div>
  );
}
