"use client";
// Fintra/components/tabs/EstimacionTab.tsx

import React from "react";

type SensitivityLevel = "Low" | "Medium" | "High";

interface SensitivityItem {
  label: string;
  level: SensitivityLevel;
}

interface EstimacionTabProps {
  selectedStock?: any;
  aiAnalysis?: string;
  marketScenarios?: string[];
  sensitivities?: SensitivityItem[];
}

function mapLevelToLabel(level: SensitivityLevel): string {
  if (level === "Low") return "Baja";
  if (level === "High") return "Alta";
  return "Media";
}

function mapLevelToClass(level: SensitivityLevel): string {
  if (level === "Low") return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/40";
  if (level === "High") return "bg-rose-900/60 text-rose-100 border border-rose-500/40";
  return "bg-amber-900/60 text-amber-100 border border-amber-500/40";
}

function renderAiParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim());
  return paragraphs.filter((p) => p.length > 0);
}

export default function EstimacionTab({
  selectedStock,
  aiAnalysis,
  marketScenarios,
  sensitivities,
}: EstimacionTabProps) {
  const symbol =
    typeof selectedStock === "string"
      ? selectedStock
      : selectedStock?.symbol || "";

  const analysisText =
    aiAnalysis && aiAnalysis.trim().length > 0
      ? aiAnalysis
      : "Aún no hay una síntesis de IA disponible para este activo. Cuando esté disponible, esta sección ofrecerá una lectura estructurada del negocio, su posición relativa y los principales vectores que explican su estado actual, sin emitir recomendaciones de compra o venta ni proyecciones de precio.";

  const analysisParagraphs = renderAiParagraphs(analysisText);

  const hasScenarios = Array.isArray(marketScenarios) && marketScenarios.length > 0;
  const hasSensitivities = Array.isArray(sensitivities) && sensitivities.length > 0;

  return (
    <div className="flex flex-col gap-3 bg-[#0a0a0a] min-h-[600px] text-white p-4">
      {/* A) Síntesis y Análisis IA */}
      <section className="bg-[#111827] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Síntesis y Análisis IA
            </h2>
            {symbol && (
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Lectura contextual generada a partir del estado actual de {symbol} en Fintra.
              </p>
            )}
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-[0.18em]">
            Capa explicativa
          </span>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm leading-relaxed text-zinc-100">
          {analysisParagraphs.map((paragraph, idx) => (
            <p key={idx} className="text-justify text-[13px] text-zinc-100/90">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* B) Escenarios de Mercado (no numéricos) */}
      <section className="bg-[#111827] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Escenarios de Mercado
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Escenarios cualitativos de régimen de mercado y cómo podrían interactuar con el
              posicionamiento relativo de la compañía.
            </p>
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-[0.18em]">
            Escenarios IA
          </span>
        </div>

        <div className="px-5 py-4">
          {hasScenarios ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {marketScenarios!.map((scenario, idx) => (
                <div
                  key={idx}
                  className="bg-[#020617] border border-zinc-800/70 rounded-md px-4 py-3 flex flex-col justify-between min-h-[120px]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Escenario {idx + 1}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-zinc-100/90 text-justify">
                    {scenario}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-zinc-500">
              No hay escenarios de mercado configurados aún para este activo. Cuando estén
              disponibles, se presentarán como descripciones cualitativas de diferentes
              regímenes (expansión de múltiplos, compresión, rotación sectorial, etc.), sin
              precios ni líneas de tiempo.
            </div>
          )}
        </div>
      </section>

      {/* C) Matriz de Sensibilidad y Contexto */}
      <section className="bg-[#111827] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Matriz de Sensibilidad y Contexto
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Lectura cualitativa de la sensibilidad del caso de inversión a distintos
              factores de entorno, sin puntuaciones numéricas ni proyecciones.
            </p>
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-[0.18em]">
            Sensibilidad
          </span>
        </div>

        <div className="px-5 py-4">
          {hasSensitivities ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sensitivities!.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#020617] border border-zinc-800/70 rounded-md px-4 py-3"
                >
                  <div className="flex-1 pr-3">
                    <p className="text-[13px] text-zinc-100/90 leading-snug">
                      {item.label}
                    </p>
                  </div>
                  <div
                    className={
                      "text-[11px] px-3 py-1 rounded-full font-medium tracking-wide " +
                      mapLevelToClass(item.level)
                    }
                  >
                    {mapLevelToLabel(item.level)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-zinc-500">
              Aún no se ha definido una matriz de sensibilidad para este activo. Cuando exista,
              aquí se resumirá la dependencia relativa frente a la valoración sectorial,
              desempeño de la industria, drivers estructurales y exposición a drawdowns, en
              términos cualitativos.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
