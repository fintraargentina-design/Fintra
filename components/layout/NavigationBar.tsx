import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp } from "lucide-react"

const tabs = [
  { id: 'datos', label: 'Resultados', icon: BarChart3 },
  { id: 'estimacion', label: 'Analistas' },
  { id: 'chart', label: 'Charts', icon: TrendingUp }
]

export default function NavigationBar({ activeTab, setActiveTab }) {
  return (
    <nav className="flex w-full flex-wrap items-end justify-between gap-2 p-1">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 ${
            activeTab === tab.id 
              ? "bg-orange-600 hover:bg-orange-700 text-white" 
              : "hover:bg-orange-300/30 text-gray-200/70"
          }`}
        >
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.label}
        </Button>
      ))}
    </nav>
  )
}