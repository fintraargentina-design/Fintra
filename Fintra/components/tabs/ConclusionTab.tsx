"use client";

import React from "react";
import FgosAnalysisBlock from "@/components/dashboard/FgosAnalysisBlock";
import SectorValuationBlock from "@/components/dashboard/SectorValuationBlock";
import { Brain, FileText, CheckCircle2 } from "lucide-react";

interface ConclusionTabProps {
  selectedStock?: any;
  stockAnalysis?: any;
  aiAnalysis?: string;
}

function renderAiParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim());
  return paragraphs.filter((p) => p.length > 0);
}

export default function ConclusionTab({
  selectedStock,
  stockAnalysis,
  aiAnalysis,
}: ConclusionTabProps) {
  const symbol =
    typeof selectedStock === "string"
      ? selectedStock
      : selectedStock?.symbol || "";

  // Extract analysis data safely
  const fgosState = stockAnalysis?.fgos_state;
  const fgosScore = stockAnalysis?.fgos_score;
  const fgosConfidenceLabel = stockAnalysis?.fgos_confidence_label;
  const fgosConfidencePercent = stockAnalysis?.fgos_confidence_percent;
  const fgosStatus = stockAnalysis?.fgos_status;
  const valuation = stockAnalysis?.valuation;

  const analysisText =
    aiAnalysis && aiAnalysis.trim().length > 0
      ? aiAnalysis
      : "Aún no hay una síntesis de IA disponible para este activo. Cuando esté disponible, esta sección ofrecerá una lectura estructurada del negocio, su posición relativa y los principales vectores que explican su estado actual, sin emitir recomendaciones de compra o venta ni proyecciones de precio.";

  const analysisParagraphs = renderAiParagraphs(analysisText);

  return (
    <div className="flex flex-col gap-6 bg-[#0e0e0e] min-h-[600px] text-white p-4 animate-in fade-in duration-300">
      
       {/* Header */}
       <div className="space-y-1 mb-2">
        <h2 className="text-lg font-medium text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#FFA028]" />
            Conclusión Fintra IA
        </h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
            Síntesis final basada en la estructura financiera, evidencia técnica y escenarios evaluados. 
            Lectura institucional del estado actual del activo.
        </p>
      </div>

      {/* 1. Structural Profile Summary (Evidence) */}
      <section className="grid grid-cols-1 gap-4">
        <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Evidencia Estructural
            </h3>
        </div>
        
        {stockAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FgosAnalysisBlock
                fgosState={fgosState}
                fgosScore={fgosScore}
                confidenceLabel={fgosConfidenceLabel}
                confidencePercent={fgosConfidencePercent}
                fgosStatus={fgosStatus}
            />
            <SectorValuationBlock valuation={valuation} />
            </div>
        )}
      </section>

      {/* 2. Fintra AI Synthesis */}
      <section className="bg-transparent border border-[#222] rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Síntesis Institucional
            </h2>
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-[0.18em]">
            Lectura Final
          </span>
        </div>
        
        <div className="px-6 py-5 space-y-4 text-sm leading-relaxed text-zinc-100 bg-gradient-to-b from-[#111827] to-[#0a0a0a]">
          {analysisParagraphs.map((paragraph, idx) => (
            <p key={idx} className="text-justify text-[13px] text-zinc-200/90 leading-7 font-light">
              {paragraph}
            </p>
          ))}
          
          <div className="mt-6 pt-4 border-t border-[#222] text-[11px] text-zinc-500 italic flex justify-center">
             Fintra no emite recomendaciones de compra o venta. Esta conclusión es una clasificación estructural.
          </div>
        </div>
      </section>

    </div>
  );
}
