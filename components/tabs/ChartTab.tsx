import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ChartTabProps {
  selectedStock: any;
}

export default function ChartTab({ selectedStock }: ChartTabProps) {
  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <Card className="bg-gray-900/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 text-lg">Gráfico de Precios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center border border-green-500/30 rounded">
            <p className="text-gray-400 text-lg">Gráfico de precios aquí</p>
          </div>
        </CardContent>
      </Card>

      {/* El div con las clases "grid grid-cols-1 md:grid-cols-3 gap-6" ha sido eliminado */}
      {/* Esto incluía los controles de Período, Tipo de Gráfico e Indicadores */}
    </div>
  );
}