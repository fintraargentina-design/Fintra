import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp } from "lucide-react"

const tabs = [
  { id: 'estimacion', label: 'Estimación' },
  { id: 'informe', label: 'Informe' },
  { id: 'datos', label: 'Datos', icon: BarChart3 },
  { id: 'noticias', label: 'Noticias' },
  { id: 'twits', label: 'Twits' },
  { id: 'chart', label: 'Charts', icon: TrendingUp }
]

export default function NavigationBar({ activeTab, setActiveTab }) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 p-1 bg-muted rounded-lg">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab(tab.id)}
          className="flex items-center gap-2"
        >
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.label}
        </Button>
      ))}
    </nav>
  )
}