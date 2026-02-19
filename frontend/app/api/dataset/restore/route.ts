import { NextResponse } from "next/server"
import { setDataset, hasDataset } from "@/lib/dataset-store"
import type { StoredDataset } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const dataset: StoredDataset = await request.json()

    if (!dataset.datasetId || !dataset.rows || !dataset.profile) {
      return NextResponse.json(
        { error: "Invalid dataset format" },
        { status: 400 }
      )
    }

    // Only restore if not already in memory
    if (!hasDataset(dataset.datasetId)) {
      setDataset(dataset)
    }

    return NextResponse.json({ success: true, datasetId: dataset.datasetId })
  } catch (error) {
    console.error("Restore error:", error)
    return NextResponse.json(
      { error: "Failed to restore dataset" },
      { status: 500 }
    )
  }
}
