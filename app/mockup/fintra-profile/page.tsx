"use client";

import React from "react";
import FintraStructuralProfile from "@/components/cards/FintraStructuralProfile";
import { Card, CardContent } from "@/components/ui/card";

export default function MockupFintraProfilePage() {
  return (
    <div className="min-h-screen bg-black text-white p-10 font-sans">
      <h1 className="text-2xl font-bold text-[#FFA028] mb-8 uppercase tracking-wider">
        Galería de Mockups: Perfil Estructural Fintra
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        
        {/* Scenario 1: The Perfect Compounder */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 1: Compounder Estructural (Líder)</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="leader"
                  ifsPressure={8}
                  sectorRank={1}
                  sectorRankTotal={145}
                  fgosBand="high"
                  relativeValuation="cheap"
                  attentionState="structural_compounder"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenario 2: Solid Follower */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 2: Seguidor de Calidad (Valor Justo)</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="follower"
                  ifsPressure={5}
                  sectorRank={42}
                  sectorRankTotal={145}
                  fgosBand="medium"
                  relativeValuation="fair"
                  attentionState="quality_in_favor"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenario 3: Structural Headwind */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 3: Rezagado / Viento en Contra (Elevada)</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="laggard"
                  ifsPressure={2}
                  sectorRank={138}
                  sectorRankTotal={145}
                  fgosBand="low"
                  relativeValuation="expensive"
                  attentionState="structural_headwind"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenario 4: Quality Misplaced */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 4: Alta Calidad pero Rezagado (Desplazada)</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="laggard"
                  ifsPressure={4}
                  sectorRank={90}
                  sectorRankTotal={145}
                  fgosBand="high"
                  relativeValuation="cheap"
                  attentionState="quality_misplaced"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenario 5: Missing Data / Pending */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 5: Datos Incompletos (Fallback)</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="not_classified"
                  ifsPressure={0}
                  // No rank
                  fgosBand="not_classified"
                  relativeValuation="not_classifiable"
                  attentionState="inconclusive"
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
         {/* Scenario 6: Mixed / Inconclusive */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-mono text-zinc-400">Escenario 6: Señales Mixtas</h2>
          <Card className="bg-tarjetas border-none shadow-lg w-full flex flex-col overflow-hidden rounded-none max-w-md">
            <CardContent className="p-0">
               <div className="border-t border-zinc-800 bg-zinc-900/40 p-6">
                <FintraStructuralProfile
                  ifsPosition="follower"
                  ifsPressure={6}
                  sectorRank={20}
                  sectorRankTotal={100}
                  fgosBand="medium"
                  relativeValuation="expensive"
                  attentionState="inconclusive"
                />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
