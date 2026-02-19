import { NextResponse } from "next/server"
import { parseCSV, createProfile, sampleRows } from "@/lib/profiler"
import { setDataset } from "@/lib/dataset-store"
import { TITANIC_CSV, TITANIC_INFO } from "@/lib/sample-datasets/titanic"
import type { StoredDataset, UploadResponse } from "@/lib/types"

export async function POST() {
  try {
    // Parse the bundled Titanic CSV
    const rows = parseCSV(TITANIC_CSV)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse sample dataset" },
        { status: 500 }
      )
    }

    // Generate dataset ID
    const datasetId = `ds_titanic_${Date.now()}`

    // Create profile
    const profile = createProfile(datasetId, rows)

    // Sample rows for visualization
    const sampledRows = sampleRows(rows)

    // Store dataset
    const dataset: StoredDataset = {
      datasetId,
      profile,
      rows,
      sampleRows: sampledRows,
    }
    setDataset(dataset)

    const response: UploadResponse = {
      datasetId,
      profile,
      storedDataset: dataset,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Sample dataset error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sample dataset" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(TITANIC_INFO)
}
