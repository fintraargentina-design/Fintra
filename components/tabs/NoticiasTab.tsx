import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NoticiasTab() {
  return (
    <Card className="bg-gray-900/50 border-green-500/30">
      <CardHeader>
        <CardTitle className="text-green-400 text-lg">📰 Noticias</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400">Noticias financieras próximamente...</p>
      </CardContent>
    </Card>
  );
}