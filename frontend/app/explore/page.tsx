"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FinancialLoading } from "@/components/financial-loading"
import { DatasetSummary } from "@/components/dataset-summary"
import { ChartGrid } from "@/components/chart-grid"
import { ChartExpandedModal } from "@/components/chart-expanded-modal"
import { getDatasetFromLocalStorage } from "@/lib/local-storage"
import type { DatasetProfile, VisSpec } from "@/lib/types"
import Loading from "./loading"

function ExploreContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const datasetId = searchParams.get("datasetId")

  const [profile, setProfile] = useState<DatasetProfile | null>(null)
  const [overviewCharts, setOverviewCharts] = useState<VisSpec[]>([])
  const [expandedChart, setExpandedChart] = useState<VisSpec | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch dataset profile and overview
  useEffect(() => {
    if (!datasetId) {
      router.push("/")
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // First, try to fetch profile from server
        let profileRes = await fetch(`/api/dataset/profile?datasetId=${datasetId}`)
        
        // If not found, try to restore from localStorage
        if (profileRes.status === 404) {
          const savedDataset = getDatasetFromLocalStorage()
          if (savedDataset && savedDataset.datasetId === datasetId) {
            // Restore to server memory
            const restoreRes = await fetch("/api/dataset/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(savedDataset),
            })
            if (restoreRes.ok) {
              // Retry fetching profile
              profileRes = await fetch(`/api/dataset/profile?datasetId=${datasetId}`)
            }
          }
        }
        
        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            throw new Error("Dataset not found. Please upload your file again.")
          }
          throw new Error("Failed to load dataset")
        }
        const profileData = await profileRes.json()
        setProfile(profileData)

        // Fetch overview charts
        const overviewRes = await fetch("/api/recommend/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasetId }),
        })
        if (!overviewRes.ok) throw new Error("Failed to generate overview")
        const overviewData = await overviewRes.json()
        setOverviewCharts(overviewData.charts)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [datasetId, router])

  // Handle chart click - open expanded modal
  const handleChartClick = useCallback((chart: VisSpec) => {
    setExpandedChart(chart)
  }, [])

  // Close modal
  const handleCloseModal = useCallback(() => {
    setExpandedChart(null)
  }, [])

  // Navigate to a new chart from within the modal
  const handleNavigateToChart = useCallback((chart: VisSpec) => {
    // Add the new chart to overview if it's not already there
    setOverviewCharts((prev) => {
      const exists = prev.some((c) => c.id === chart.id)
      if (exists) return prev
      return [chart, ...prev]
    })
  }, [])

  if (isLoading) {
    return <FinancialLoading />
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground">{error || "Dataset not found"}</p>
          <Button asChild>
            <Link href="/">
              Upload a new file
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background animate-in fade-in duration-500">
      {/* Dataset info bar - sticks to top when navbar hides on scroll */}
      <div className="sticky top-0 z-30 border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-11 px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">{profile.rowCount.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">rows</span>
            <div className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {profile.columns.length} columns
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left Panel - Dataset Summary */}
          <aside className="hidden lg:block">
            <DatasetSummary profile={profile} />
          </aside>

          {/* Main Content - Charts */}
          <main className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">Overview</h2>
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {overviewCharts.length} charts
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Click any chart to explore deeper with AI-powered insights
              </p>
              <ChartGrid
                charts={overviewCharts}
                selectedChartId={null}
                onSelectChart={handleChartClick}
                emptyMessage="No overview charts generated"
              />
            </div>
          </main>
        </div>
      </div>

      {/* Expanded Chart Modal */}
      {expandedChart && profile && datasetId && (
        <ChartExpandedModal
          chart={expandedChart}
          profile={profile}
          datasetId={datasetId}
          onClose={handleCloseModal}
          onNavigateToChart={handleNavigateToChart}
        />
      )}
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExploreContent />
    </Suspense>
  )
}
