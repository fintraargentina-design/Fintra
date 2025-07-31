import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EstimacionTab() {
  return (
    <Card className="bg-gray-900/50 border-green-500/30">
      <CardHeader>
        <CardTitle className="text-green-400 text-lg">📊 Estimación</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400">Estimaciones y proyecciones próximamente...</p>
      </CardContent>
    </Card>
  );
}