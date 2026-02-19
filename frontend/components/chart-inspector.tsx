"use client"

import { useState } from "react"
import { Sparkles, Loader2, AlertTriangle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VegaChart } from "@/components/vega-chart"
import { Badge } from "@/components/ui/badge"
import type { VisSpec, LLMInsightsResponse, Clause } from "@/lib/types"

interface ChartInspectorProps {
  chart: VisSpec
  datasetId: string
  onApplyAction?: (intentPatch: Clause[]) => void
}

export function ChartInspector({ chart, datasetId, onApplyAction }: ChartInspectorProps) {
  const [insights, setInsights] = useState<LLMInsightsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateInsights = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/llm/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          visSpec: chart,
          chartSummaryStats: {
            chartType: chart.chartType,
            xField: chart.intent.clauses.find((c) => c.role === "x")?.field,
            yField: chart.intent.clauses.find((c) => c.role === "y")?.field,
            colorField: chart.intent.clauses.find((c) => c.role === "color")?.field,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate insights")
      }

      const data = await response.json()
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate insights")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{chart.title}</CardTitle>
        <Badge variant="outline" className="w-fit">
          {chart.chartType}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[6px] border p-4 bg-background">
          <VegaChart spec={chart.vegaLite} className="w-full" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">AI Insights</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInsights}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {insights ? "Regenerate" : "Generate insights"}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {insights && (
            <div className="space-y-3">
              <div className="space-y-2">
                {insights.insights.map((insight, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    • {insight}
                  </p>
                ))}
              </div>

              {insights.warnings.length > 0 && (
                <div className="rounded-[6px] bg-yellow-500/10 p-3 space-y-1">
                  {insights.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-yellow-700 dark:text-yellow-500">
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              {insights.nextActions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase">
                    Suggested Actions
                  </h5>
                  {insights.nextActions.map((action, i) => (
                    <Button
                      key={i}
                      variant="secondary"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => onApplyAction?.(action.intentPatch)}
                    >
                      {action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!insights && !isLoading && !error && (
            <p className="text-sm text-muted-foreground">
              Click &quot;Generate insights&quot; to get AI-powered analysis and suggestions.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
