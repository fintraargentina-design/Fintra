import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";

interface InformeTabProps {
  stockReport: any;
}

export default function InformeTab({ stockReport }: InformeTabProps) {
  const [activeSection, setActiveSection] = useState('analisisFundamental');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sections = [
    { key: 'analisisFundamental', label: 'Análisis Fundamental' },
    { key: 'analisisCualitativo', label: 'Análisis Cualitativo' },
    { key: 'analisisValoracion', label: 'Análisis Valoración' },
    { key: 'analisisDividendos', label: 'Análisis Dividendos' },
    { key: 'analisisDesempeno', label: 'Análisis Desempeño' }
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
    if (!stockReport || !stockReport[activeSection]) {
      return (
        <div className="text-gray-400 text-center py-8">
          No hay información disponible para esta sección
        </div>
      );
    }

    const sectionData = stockReport[activeSection];
    
    return (
      <div className="space-y-6">
        {Object.entries(sectionData).map(([key, value]) => (
          <div key={key} className="space-y-3">
            <h3 className="text-green-400 text-lg font-semibold capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <p className="text-gray-300 leading-relaxed">
                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Columna izquierda - Pestañas (25%) */}
      <div className="w-1/4 pr-4">
        <Card className="bg-gray-900/50 border-green-500/30 h-full">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Secciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => handleSectionChange(section.key)}
                  className={`w-full text-left px-4 py-3 transition-all duration-200 ${
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
              {sections.find(s => s.key === activeSection)?.label || 'Informe'}
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