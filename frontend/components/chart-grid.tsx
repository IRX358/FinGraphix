"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VegaChart } from "@/components/vega-chart"
import { cn } from "@/lib/utils"
import type { VisSpec } from "@/lib/types"

interface ChartGridProps {
  charts: VisSpec[]
  selectedChartId: string | null
  onSelectChart: (chart: VisSpec) => void
  emptyMessage?: string
}

// Extract width from Vega-Lite spec
function getChartWidth(spec: object): number {
  const vegaSpec = spec as { width?: number | string }
  if (typeof vegaSpec.width === "number") {
    return vegaSpec.width
  }
  return 300 // Default width
}

export function ChartGrid({
  charts,
  selectedChartId,
  onSelectChart,
  emptyMessage = "No charts available",
}: ChartGridProps) {
  if (charts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {charts.map((chart) => (
        <Card
          key={chart.id}
          className={cn(
            "cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg",
            selectedChartId === chart.id && "ring-2 ring-primary border-primary"
          )}
          onClick={() => onSelectChart(chart)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium truncate" title={chart.title}>
              {chart.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VegaChart spec={chart.vegaLite} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
