import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import { getConclusionColors } from '@/lib/conclusionColors';

interface ConclusionRapidaCardProps {
  stockConclusion: any;
  stockBasicData?: any;
  stockAnalysis?: any;
}

export default function ConclusionRapidaCard({ stockConclusion, stockBasicData, stockAnalysis }: ConclusionRapidaCardProps) {
  const [activeSection, setActiveSection] = useState('negocio');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
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

  const sections = [
    { key: 'negocio', label: '¿Qué hace la empresa?' },
    { key: 'ventaja', label: '¿Tiene una ventaja clara frente a la competencia?' },
    { key: 'rentabilidad', label: '¿Gana dinero de verdad y lo sigue haciendo crecer?' },
    { key: 'crecimiento', label: '¿El negocio puede seguir creciendo en 5 o 10 años?' },
    { key: 'valoracion', label: '¿El precio tiene sentido o está inflado?' },
    { key: 'resumen', label: '¿Es una buena compra?' }
  ];

  // Reiniciar scroll cuando cambie la sección activa
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  const handleSectionChange = (sectionKey: string) => {
    setActiveSection(sectionKey);
  };

  const renderContent = () => {
    if (!stockConclusion) {
      return (
        <div className="text-gray-400 text-center py-8">
          No hay información de análisis disponible
        </div>
      );
    }

    switch (activeSection) {
      case 'resumen':
        return (
          <div className="space-y-6">
            <div className={`${colors.textColor} text-lg leading-relaxed`}>
                {conclusion || 'No hay conclusión disponible'}
            </div>
            {/* <div className={`${colors.bgColor} ${colors.borderColor} p-6 rounded-lg border-2`}>
              <h3 className={`${colors.textColor} text-xl font-bold mb-4`}>
                Conclusión General
              </h3>
              
            </div> */}
          </div>
        );
        
      case 'negocio':
        return (
          <div className="space-y-4">
            {/* <h3 className="text-green-400 text-xl font-semibold mb-4">
              ¿Qué hace la empresa?
            </h3> */}
            <div className="bg-gray-900/50 p-4 rounded border-l-4 border-green-500/50">
              <p className="text-gray-200 leading-relaxed">
                {analysisData.queHace}
              </p>
            </div>
          </div>
        );
        
      case 'ventaja':
        return (
          <div className="space-y-4">
            {/* <h3 className="text-green-400 text-xl font-semibold mb-4">
              ¿Tiene una ventaja clara frente a la competencia?
            </h3> */}
            <div className="bg-gray-900/50 p-4 rounded border-l-4 border-blue-500/50">
              <p className="text-gray-200 leading-relaxed">
                {analysisData.ventajaCompetitiva}
              </p>
            </div>
          </div>
        );
        
      case 'rentabilidad':
        return (
          <div className="space-y-4">
            {/* <h3 className="text-green-400 text-xl font-semibold mb-4">
              ¿Gana dinero de verdad y lo sigue haciendo crecer?
            </h3> */}
            <div className="bg-gray-900/50 p-4 rounded border-l-4 border-yellow-500/50">
              <p className="text-gray-200 leading-relaxed">
                {analysisData.ganaDinero}
              </p>
            </div>
          </div>
        );
        
      case 'crecimiento':
        return (
          <div className="space-y-4">
            {/* <h3 className="text-green-400 text-xl font-semibold mb-4">
              ¿El negocio puede seguir creciendo en 5 o 10 años?
            </h3> */}
            <div className="bg-gray-900/50 p-4 rounded border-l-4 border-purple-500/50">
              <p className="text-gray-200 leading-relaxed">
                {analysisData.crecimientoFuturo}
              </p>
            </div>
          </div>
        );
        
      case 'valoracion':
        return (
          <div className="space-y-4">
            {/* <h3 className="text-green-400 text-xl font-semibold mb-4">
              ¿El precio tiene sentido o está inflado?
            </h3> */}
            <div className="bg-gray-900/50 p-4 rounded border-l-4 border-red-500/50">
              <p className="text-gray-200 leading-relaxed">
                {analysisData.precioSentido}
              </p>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="text-gray-400 text-center py-8">
            Selecciona una sección para ver el contenido
          </div>
        );
    }
  };

  return (
    <div className="flex h-full">
      {/* Columna izquierda - Pestañas (25%) */}
      <div className="w-1/4 pr-4">
        <Card className="bg-gray-900/50 border-green-500/30 h-full">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Análisis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => handleSectionChange(section.key)}
                  className={`w-full text-left px-4 py-3 transition-all duration-200 text-sm ${
                    activeSection === section.key
                      ? 'bg-green-500/20 text-green-400 border-r-2 border-green-500'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-green-300'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columna derecha - Contenido (75%) */}
      <div className="w-3/4">
        <Card className="bg-gray-900/50 border-green-500/30 h-full">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">
              {sections.find(s => s.key === activeSection)?.label || 'Resumen Estratégico'}
            </CardTitle>
          </CardHeader>
          <CardContent 
            ref={scrollContainerRef}
            className="max-h-96 overflow-y-auto"
          >
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}