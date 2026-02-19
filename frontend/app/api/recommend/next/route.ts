import { NextResponse } from "next/server"
import { getDataset } from "@/lib/dataset-store"
import { generateEnhanced, generateFiltered, generateGeneralized } from "@/lib/recommender"
import type { RecommendResponse, VisSpec } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { datasetId, selectedVis, mode } = body as {
      datasetId: string
      selectedVis: VisSpec
      mode: "enhance" | "filter" | "generalize"
    }

    if (!datasetId || !selectedVis || !mode) {
      return NextResponse.json(
        { error: "datasetId, selectedVis, and mode are required" },
        { status: 400 }
      )
    }

    const dataset = getDataset(datasetId)

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Use sample rows for faster processing
    const rows = dataset.sampleRows.length > 0 ? dataset.sampleRows : dataset.rows

    let charts: VisSpec[] = []

    switch (mode) {
      case "enhance":
        charts = generateEnhanced(dataset.profile, rows, selectedVis)
        break
      case "filter":
        charts = generateFiltered(dataset.profile, rows, selectedVis)
        break
      case "generalize":
        charts = generateGeneralized(dataset.profile, rows, selectedVis)
        break
      default:
        return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const response: RecommendResponse = { charts }
    return NextResponse.json(response)
  } catch (error) {
    console.error("Next recommendation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate recommendations" },
      { status: 500 }
    )
  }
}
