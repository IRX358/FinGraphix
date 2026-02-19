import { NextResponse } from "next/server"
import { getDataset } from "@/lib/dataset-store"
import { generateOverview } from "@/lib/recommender"
import type { RecommendResponse } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { datasetId } = body

    if (!datasetId) {
      return NextResponse.json({ error: "datasetId is required" }, { status: 400 })
    }

    const dataset = getDataset(datasetId)

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Use sample rows for faster processing
    const rows = dataset.sampleRows.length > 0 ? dataset.sampleRows : dataset.rows
    const charts = generateOverview(dataset.profile, rows)

    const response: RecommendResponse = { charts }
    return NextResponse.json(response)
  } catch (error) {
    console.error("Overview error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate overview" },
      { status: 500 }
    )
  }
}
