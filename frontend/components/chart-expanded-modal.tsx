"use client"

import { useState, useEffect } from "react"
import { X, Sparkles, Loader2, ChevronRight, ChevronLeft, ChevronDown, Layers, SlidersHorizontal, GitCompare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VegaChart } from "@/components/vega-chart"
import type { VisSpec, DatasetProfile, DrillDownOption } from "@/lib/types"

interface ChartExpandedModalProps {
  chart: VisSpec
  profile: DatasetProfile
  datasetId: string
  onClose: () => void
  onNavigateToChart: (chart: VisSpec) => void
}

interface DrillDownInsights {
  summary: string
  keyFindings: string[]
  drillDownOptions: DrillDownOption[]
  relatedQuestions: string[]
}

interface ExplorationState {
  chart: VisSpec
  clauses: { label: string; type: string }[]
}

export function ChartExpandedModal({
  chart,
  profile,
  datasetId,
  onClose,
}: ChartExpandedModalProps) {
  const [insights, setInsights] = useState<DrillDownInsights | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [drillDownCharts, setDrillDownCharts] = useState<VisSpec[]>([])
  const [isLoadingDrillDown, setIsLoadingDrillDown] = useState(false)
  const [currentChart, setCurrentChart] = useState<VisSpec>(chart)
  const [activeTab, setActiveTab] = useState<"breakdown" | "slice" | "compare">("breakdown")
  const [insightsExpanded, setInsightsExpanded] = useState(false)
  
  // History for back/forward navigation
  const [historyStack, setHistoryStack] = useState<ExplorationState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  // Current exploration clauses (for chips)
  const [clauses, setClauses] = useState<{ label: string; type: string }[]>(() => {
    const fieldLabel = chart.intent?.columns?.[0] || chart.title || "Unknown"
    const chartLabel = chart.chartType || "chart"
    return [
      { label: fieldLabel, type: "field" },
      { label: chartLabel, type: "chart" },
    ]
  })

  // Disable body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Generate insights and initial recommendations when chart changes
  useEffect(() => {
    generateInsights()
    loadInitialRecommendations()
  }, [currentChart])

  const generateInsights = async () => {
    setIsLoadingInsights(true)

    try {
      const response = await fetch("/api/llm/drilldown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          visSpec: currentChart,
          profile: {
            rowCount: profile.rowCount,
            columns: profile.columns.map((c) => ({
              name: c.name,
              type: c.type,
              cardinality: c.cardinality,
            })),
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to generate insights")
      const data = await response.json()
      setInsights(data)
    } catch (error) {
      console.error("Failed to generate insights:", error)
      setInsights(null)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const loadInitialRecommendations = async () => {
    // Auto-load breakdown recommendations on initial open
    // Find a suitable categorical column to use as default breakdown field
    const categoricalCols = profile.columns.filter(
      c => c.type === "category" && c.cardinality > 1 && c.cardinality <= 10
    )
    const defaultField = categoricalCols[0]?.name || profile.columns.find(c => c.type === "category")?.name
    
    if (defaultField) {
      const defaultOption: DrillDownOption = {
        type: "breakdown",
        label: `Break down by ${defaultField}`,
        description: "Automatic breakdown suggestions",
        field: defaultField,
      }
      await loadDrillDownCharts(defaultOption, "breakdown")
    }
  }

  const loadDrillDownCharts = async (option: DrillDownOption | null, tabType: typeof activeTab) => {
    setIsLoadingDrillDown(true)

    try {
      // Find appropriate fields for the tab type if no specific option
      let field = option?.field
      if (!field) {
        if (tabType === "breakdown") {
          const categoricalCols = profile.columns.filter(
            c => c.type === "category" && c.cardinality > 1 && c.cardinality <= 10
          )
          field = categoricalCols[0]?.name || profile.columns.find(c => c.type === "category")?.name
        } else if (tabType === "slice") {
          const categoricalCols = profile.columns.filter(
            c => c.type === "category" && c.topValues && c.topValues.length > 0
          )
          field = categoricalCols[0]?.name
        } else if (tabType === "compare") {
          const numericCols = profile.columns.filter(
            c => c.type === "number" && c.name !== currentChart.intent?.clauses?.find(cl => cl.role === "x")?.field
          )
          field = numericCols[0]?.name || profile.columns.find(c => c.type === "category")?.name
        }
      }

      if (!field) {
        setDrillDownCharts([])
        setIsLoadingDrillDown(false)
        return
      }

      const response = await fetch("/api/recommend/drilldown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          currentVis: currentChart,
          drillDownOption: { 
            type: tabType, 
            label: option?.label || `${tabType} by ${field}`,
            description: option?.description || "",
            field,
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to generate drill-down")
      const data = await response.json()
      setDrillDownCharts(data.charts || [])
    } catch (error) {
      console.error("Failed to generate drill-down:", error)
      setDrillDownCharts([])
    } finally {
      setIsLoadingDrillDown(false)
    }
  }

  // Reload recommendations when tab changes
  useEffect(() => {
    loadDrillDownCharts(null, activeTab)
  }, [activeTab])

  const handleSelectDrillDownChart = (newChart: VisSpec) => {
    // Save current state to history
    const currentState: ExplorationState = { chart: currentChart, clauses: [...clauses] }
    const newHistory = [...historyStack.slice(0, historyIndex + 1), currentState]
    setHistoryStack(newHistory)
    setHistoryIndex(newHistory.length - 1)
    
    // Add new clause - safely access nested properties
    const titleDiff = (newChart.title || "").replace(currentChart.title || "", "").trim()
    const fallbackLabel = newChart.intent?.columns?.[0] || "drill-down"
    const newClause = { 
      label: titleDiff || fallbackLabel, 
      type: activeTab 
    }
    setClauses(prev => [...prev, newClause])
    
    // Update chart
    setCurrentChart(newChart)
    setDrillDownCharts([])
  }

  const handleGoBack = () => {
    if (historyIndex >= 0 && historyStack[historyIndex]) {
      const prevState = historyStack[historyIndex]
      setCurrentChart(prevState.chart)
      setClauses(prevState.clauses)
      setHistoryIndex(historyIndex - 1)
      setDrillDownCharts([])
    }
  }

  const handleGoForward = () => {
    if (historyIndex < historyStack.length - 1 && historyStack[historyIndex + 1]) {
      const nextState = historyStack[historyIndex + 1]
      setCurrentChart(nextState.chart)
      setClauses(nextState.clauses)
      setHistoryIndex(historyIndex + 1)
      setDrillDownCharts([])
    }
  }

  const handleRemoveClause = (index: number) => {
    if (index <= 1) return // Can't remove base field and chart type
    
    // Find the history state before this clause was added
    const targetIndex = index - 2 // Subtract 2 for the initial field + chart clauses
    if (targetIndex >= 0 && targetIndex < historyStack.length && historyStack[targetIndex]) {
      const targetState = historyStack[targetIndex]
      setCurrentChart(targetState.chart)
      setClauses(targetState.clauses)
      setHistoryIndex(targetIndex - 1)
      setDrillDownCharts([])
    } else if (historyIndex >= 0 && historyStack.length > 0) {
      // Fall back to going back one step
      handleGoBack()
    } else {
      // Reset to initial chart if no history
      setClauses(clauses.slice(0, index))
    }
  }

  // Group drill-down options by type
  const breakdownOptions = insights?.drillDownOptions.filter(o => o.type === "breakdown") || []
  const filterOptions = insights?.drillDownOptions.filter(o => o.type === "filter") || []
  const compareOptions = insights?.drillDownOptions.filter(o => o.type === "compare") || []

  const canGoBack = historyIndex >= 0
  const canGoForward = historyIndex < historyStack.length - 1

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 bg-card/50 backdrop-blur-md px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Back/Forward Navigation */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              onClick={handleGoBack}
              disabled={!canGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              onClick={handleGoForward}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <h2 className="text-lg font-semibold">{currentChart.title}</h2>
        </div>
        
        {/* State Chips */}
        <div className="flex items-center gap-2 flex-1 justify-center overflow-x-auto px-4">
          {clauses.map((clause, i) => (
            <Badge 
              key={i} 
              variant={i < 2 ? "secondary" : "outline"}
              className={`flex items-center gap-1 flex-shrink-0 ${i >= 2 ? "border-primary/30 bg-primary/10 text-primary" : ""}`}
            >
              {clause.label}
              {i >= 2 && (
                <button 
                  className="ml-1 hover:text-destructive"
                  onClick={() => handleRemoveClause(i)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left - Selected Chart */}
        <div className="w-[380px] border-r border-border/50 flex flex-col bg-card/30">
          <div className="px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Selected chart</h3>
          </div>
          
          {/* Takeaway - Compact AI Insights */}
          <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
            {isLoadingInsights ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing...
              </div>
            ) : insights ? (
              <div>
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-snug">{insights.summary}</p>
                </div>
                
                {insights.keyFindings.length > 0 && (
                  <>
                    <button 
                      className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground"
                      onClick={() => setInsightsExpanded(!insightsExpanded)}
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${insightsExpanded ? "rotate-180" : ""}`} />
                      {insightsExpanded ? "Hide details" : "Show details"}
                    </button>
                    
                    {insightsExpanded && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {insights.keyFindings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-primary">•</span>
                            {finding}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ) : (
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Generate insights
              </button>
            )}
          </div>
          
          {/* Chart */}
          <div className="flex-1 p-4 flex items-start justify-center overflow-auto">
            <div className="rounded-[6px] border border-border/50 bg-card/50 p-4 overflow-hidden shadow-lg">
              <div style={{ width: 300 }}>
                <VegaChart spec={currentChart.vegaLite} />
              </div>
            </div>
          </div>
        </div>

        {/* Right - Explore Next */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with Tabs */}
          <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Explore next</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Pick a thumbnail to drill in.</p>
            </div>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="breakdown" className="gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Break down
                </TabsTrigger>
                <TabsTrigger value="slice" className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Slice
                </TabsTrigger>
                <TabsTrigger value="compare" className="gap-1.5">
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Chart Thumbnails - Single Column Scroll */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isLoadingDrillDown ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-64 rounded-[6px] border bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : drillDownCharts.length > 0 ? (
              <div className="space-y-4">
                {drillDownCharts.map((drillChart) => (
                  <button
                    key={drillChart.id}
                    className="w-full rounded-[6px] border border-border/50 bg-card/50 p-4 text-left hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all group overflow-hidden"
                    onClick={() => handleSelectDrillDownChart(drillChart)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 overflow-hidden rounded-[4px] border border-border/50 bg-card p-2" style={{ width: 320 }}>
                        <VegaChart spec={drillChart.vegaLite} />
                      </div>
                      <div className="flex-1 min-w-0 py-2">
                        <p className="font-medium">{drillChart.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activeTab === "breakdown" && "Color grouped by dimension"}
                          {activeTab === "slice" && "Filtered to specific subset"}
                          {activeTab === "compare" && "Relationship comparison view"}
                        </p>
                        <div className="mt-3 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          Explore this view
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    {activeTab === "breakdown" && <Layers className="h-6 w-6 text-muted-foreground" />}
                    {activeTab === "slice" && <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />}
                    {activeTab === "compare" && <GitCompare className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "breakdown" && "Break down the current view by adding a grouping dimension."}
                    {activeTab === "slice" && "Filter to focus on specific subsets of the data."}
                    {activeTab === "compare" && "Compare this metric with other variables or groups."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
