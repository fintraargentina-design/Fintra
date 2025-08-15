import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, FileText } from "lucide-react"

const tabs = [
  { id: 'datos', label: 'Resultados', icon: BarChart3 },
  { id: 'estimacion', label: 'Analistas' },
  { id: 'informe', label: 'Análisis' },
  { id: 'noticias', label: 'Noticias' },
  { id: 'chart', label: 'Charts', icon: TrendingUp }
]

export default function NavigationBar({ activeTab, setActiveTab }) {
  return (
    <nav className="flex flex-wrap items-end justify-end gap-2 p-1">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 ${
            activeTab === tab.id 
              ? "bg-gray-600 hover:bg-gray-700 text-white" 
              : "bg-gray-200 hover:bg-gray-300 text-gray-700"
          }`}
        >
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.label}
        </Button>
      ))}
    </nav>
  )
}