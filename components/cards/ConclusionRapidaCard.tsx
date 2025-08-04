import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { getConclusionColors } from '@/lib/conclusionColors';

interface ConclusionRapidaCardProps {
  stockConclusion: any;
}

export default function ConclusionRapidaCard({ stockConclusion }: ConclusionRapidaCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const conclusion = stockConclusion?.conclusion?.Conclusión;
  const colors = getConclusionColors(conclusion);
  
  // Extraer las respuestas específicas del objeto conclusion
  const analysisData = {
    queHace: stockConclusion?.conclusion?.["¿Qué hace la empresa?"] || "No disponible",
    ventajaCompetitiva: stockConclusion?.conclusion?.["¿Tiene una ventaja clara frente a la competencia?"] || "No disponible",
    ganaDinero: stockConclusion?.conclusion?.["¿Gana dinero de verdad y lo sigue haciendo crecer?"] || "No disponible",
    crecimientoFuturo: stockConclusion?.conclusion?.["¿El negocio puede seguir creciendo en 5 o 10 años?"] || "No disponible",
    precioSentido: stockConclusion?.conclusion?.["¿El precio tiene sentido o está inflado?"] || "No disponible"
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className={`${colors.bgColor} ${colors.borderColor} cursor-pointer transition-all duration-300 hover:border-[#00FF00] hover:shadow-lg hover:shadow-[#00FF00]/20`}>
          <CardHeader className="pb-3">
            <CardTitle className={`${colors.textColor} text-lg group-hover:text-green-300 transition-colors`}>
              Conclusión rápida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`space-y-4 ${colors.textColor}`}>
              {conclusion || 'No hay conclusión disponible'}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-gray-900 border-green-500/30">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-xl mb-4">
            Análisis de Inversión - {stockConclusion?.symbol || 'N/A'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          
          {/* Análisis Detallado */}
          <div className="grid grid-cols-1 gap-6">
            {/* 1. ¿Qué hace la empresa? */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-green-400 text-lg font-semibold mb-3 flex items-center gap-2">        
                1. ¿Qué hace la empresa?
              </h3>            
              <div className="bg-gray-900/50 p-3 rounded border-l-4 border-green-500/50">
                <p className="text-gray-200 leading-relaxed">
                  {analysisData.queHace}
                </p>
              </div>
            </div>

            {/* 2. ¿Tiene una ventaja clara frente a la competencia? */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-green-400 text-lg font-semibold mb-3 flex items-center gap-2">
                2. ¿Tiene una ventaja clara frente a la competencia?
              </h3>
              <div className="bg-gray-900/50 p-3 rounded border-l-4 border-blue-500/50">
                <p className="text-gray-200 leading-relaxed">
                  {analysisData.ventajaCompetitiva}
                </p>
              </div>
            </div>

            {/* 3. ¿Gana dinero de verdad y lo sigue haciendo crecer? */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-green-400 text-lg font-semibold mb-3 flex items-center gap-2">
                3. ¿Gana dinero de verdad y lo sigue haciendo crecer?
              </h3>
              <div className="bg-gray-900/50 p-3 rounded border-l-4 border-yellow-500/50">
                <p className="text-gray-200 leading-relaxed">
                  {analysisData.ganaDinero}
                </p>
              </div>
            </div>

            {/* 4. ¿El negocio puede seguir creciendo en 5 o 10 años? */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-green-400 text-lg font-semibold mb-3 flex items-center gap-2">
                4. ¿El negocio puede seguir creciendo en 5 o 10 años?
              </h3>
              <div className="bg-gray-900/50 p-3 rounded border-l-4 border-purple-500/50">
                <p className="text-gray-200 leading-relaxed">
                  {analysisData.crecimientoFuturo}
                </p>
              </div>
            </div>

            {/* 5. ¿El precio tiene sentido o está inflado? */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-green-400 text-lg font-semibold mb-3 flex items-center gap-2">
                5. ¿El precio tiene sentido o está inflado?
              </h3>
              <div className="bg-gray-900/50 p-3 rounded border-l-4 border-red-500/50">
                <p className="text-gray-200 leading-relaxed">
                  {analysisData.precioSentido}
                </p>
              </div>
            </div>
          </div>         
        </div>
      </DialogContent>
    </Dialog>
  );
}