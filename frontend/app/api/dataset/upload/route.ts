import { NextResponse } from "next/server"
import { parseCSV, createProfile, sampleRows, MAX_FILE_SIZE } from "@/lib/profiler"
import { setDataset } from "@/lib/dataset-store"
import type { StoredDataset, UploadResponse } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Check file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 }
      )
    }

    // Read and parse CSV
    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty or invalid" },
        { status: 400 }
      )
    }

    // Generate dataset ID
    const datasetId = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Create profile
    const profile = createProfile(datasetId, rows)

    // Sample rows for large datasets
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
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    )
  }
}
