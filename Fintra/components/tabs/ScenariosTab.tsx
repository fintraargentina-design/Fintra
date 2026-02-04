"use client";

import React from "react";
import { AlertTriangle, Globe, Scale } from "lucide-react";

type SensitivityLevel = "Low" | "Medium" | "High";

interface SensitivityItem {
  label: string;
  level: SensitivityLevel;
}

interface ScenariosTabProps {
  marketScenarios?: string[];
  sensitivities?: SensitivityItem[];
}

function mapLevelToLabel(level: SensitivityLevel): string {
  if (level === "Low") return "Baja";
  if (level === "High") return "Alta";
  return "Media";
}

function mapLevelToClass(level: SensitivityLevel): string {
  if (level === "Low") return "bg-zinc-800 text-zinc-300 border-zinc-700"; // Neutral/Low impact
  if (level === "High") return "bg-zinc-800 text-zinc-100 border-zinc-600 font-medium"; // High impact
  return "bg-zinc-800 text-zinc-300 border-zinc-700";
}

export default function ScenariosTab({
  marketScenarios,
  sensitivities,
}: ScenariosTabProps) {
  const hasScenarios = Array.isArray(marketScenarios) && marketScenarios.length > 0;
  const hasSensitivities = Array.isArray(sensitivities) && sensitivities.length > 0;

  // Simple heuristic to split scenarios if possible, otherwise list all
  const baseScenario = hasScenarios ? marketScenarios[0] : null;
  const alternativeScenarios = hasScenarios ? marketScenarios.slice(1) : [];

  return (
    <div className="flex flex-col gap-4 bg-[#0e0e0e] min-h-[600px] text-white p-4 animate-in fade-in duration-300">
      
      {/* 1. Scenario Overview / Header */}
      <div className="space-y-1 mb-2">
        <h2 className="text-lg font-medium text-white tracking-tight">
          Exploración de Escenarios Condicionales
        </h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
          Esta sección explora contextos condicionales plausibles y factores externos. 
          No constituye una predicción ni una recomendación, sino un análisis de sensibilidad ante distintas coyunturas.
        </p>
      </div>

      {/* 2. Base Scenario */}
      <section className="bg-transparent border border-[#222] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">
              Escenario Base
            </h3>
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-wider">
            Hipótesis Central
          </span>
        </div>
        <div className="p-5">
          {baseScenario ? (
            <p className="text-[13px] leading-relaxed text-zinc-300 text-justify border-l-2 border-blue-500/30 pl-4">
              {baseScenario}
            </p>
          ) : (
            <p className="text-sm text-zinc-500 italic">
              No hay un escenario base definido actualmente.
            </p>
          )}
        </div>
      </section>

      {/* 3. Alternative / Conditional Scenarios */}
      {alternativeScenarios.length > 0 && (
        <section className="bg-transparent border border-[#222] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">
                Escenarios Alternativos
              </h3>
            </div>
            <span className="text-[10px] uppercase text-zinc-500 tracking-wider">
              Condicionales
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {alternativeScenarios.map((scenario, idx) => (
              <div 
                key={idx}
                className="bg-[#111] border border-[#222] rounded p-4 hover:border-zinc-700 transition-colors"
              >
                <span className="text-[10px] uppercase text-zinc-500 font-bold mb-2 block">
                  Alternativa {idx + 1}
                </span>
                <p className="text-[13px] leading-relaxed text-zinc-300 text-justify">
                  {scenario}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. External Constraints (Sensitivities & ESG) */}
      <section className="bg-transparent border border-[#222] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500/80" />
            <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">
              Restricciones Externas y Contexto
            </h3>
          </div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-wider">
            Non-Financial / ESG Context
          </span>
        </div>
        
        <div className="p-5">
            <div className="mb-4 text-[12px] text-zinc-400 border-b border-[#222] pb-2">
                Factores exógenos (Regulación, Macro, ESG) que actúan como restricciones o condiciones de contorno. 
                Estos factores <strong>no alteran</strong> el cálculo estructural (FGOS/IFS) pero aportan contexto de riesgo.
            </div>

          {hasSensitivities ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sensitivities!.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#111] border border-[#222] rounded px-4 py-3"
                >
                  <div className="flex-1 pr-3">
                    <p className="text-[13px] text-zinc-200 leading-snug">
                      {item.label}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] text-zinc-500 uppercase mb-0.5">Sensibilidad</span>
                     <div
                        className={
                        "text-[10px] px-2 py-0.5 rounded border " +
                        mapLevelToClass(item.level)
                        }
                    >
                        {mapLevelToLabel(item.level)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-zinc-500 italic">
              No se han identificado restricciones externas críticas o factores de sensibilidad específicos.
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
