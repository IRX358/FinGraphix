import { NextResponse } from "next/server"
import { getDataset } from "@/lib/dataset-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const datasetId = searchParams.get("datasetId")

  if (!datasetId) {
    return NextResponse.json({ error: "datasetId is required" }, { status: 400 })
  }

  const dataset = getDataset(datasetId)

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
  }

  return NextResponse.json(dataset.profile)
}
