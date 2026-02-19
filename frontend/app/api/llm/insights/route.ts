import { NextResponse } from "next/server"
import { generateText } from "ai"
import { getDataset } from "@/lib/dataset-store"
import type { VisSpec, ChartSummaryStats, LLMInsightsResponse } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { datasetId, visSpec, chartSummaryStats } = body as {
      datasetId: string
      visSpec: VisSpec
      chartSummaryStats: ChartSummaryStats
    }

    if (!datasetId || !visSpec) {
      return NextResponse.json(
        { error: "datasetId and visSpec are required" },
        { status: 400 }
      )
    }

    const dataset = getDataset(datasetId)

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Build prompt
    const prompt = buildInsightPrompt(dataset.profile, visSpec, chartSummaryStats)

    // Call LLM
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      maxTokens: 1000,
    })

    // Parse response
    const insights = parseInsightResponse(text)

    return NextResponse.json(insights)
  } catch (error) {
    console.error("LLM insights error:", error)
    
    // Return fallback insights on error
    const fallback: LLMInsightsResponse = {
      insights: [
        "Unable to generate AI insights at this time.",
        "The visualization shows the data distribution.",
        "Consider exploring related dimensions.",
      ],
      warnings: ["AI analysis unavailable"],
      nextActions: [],
    }
    
    return NextResponse.json(fallback)
  }
}

function buildInsightPrompt(
  profile: { rowCount: number; colCount: number; columns: Array<{ name: string; type: string }> },
  visSpec: VisSpec,
  stats?: ChartSummaryStats
): string {
  const datasetSummary = `Dataset: ${profile.rowCount} rows, ${profile.colCount} columns
Columns: ${profile.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`

  const chartInfo = `Chart: ${visSpec.title}
Type: ${visSpec.chartType}
Intent: ${JSON.stringify(visSpec.intent)}`

  const statsInfo = stats
    ? `Statistics: ${JSON.stringify(stats, null, 2)}`
    : "No additional statistics available"

  return `You are a data analyst assistant. Analyze this chart and provide insights.

${datasetSummary}

${chartInfo}

${statsInfo}

Respond with a JSON object in this exact format:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "warnings": ["warning if any"],
  "nextActions": [
    {"label": "Action description", "intentPatch": [{"field": "fieldname", "role": "filter", "op": "=", "value": "somevalue"}]},
    {"label": "Another action", "intentPatch": [{"field": "fieldname", "role": "color"}]}
  ]
}

Requirements:
- Provide exactly 3 short, actionable insights about patterns or anomalies
- Include 0-2 warnings about data quality issues if relevant
- Suggest 2 next exploration actions that would help understand the data better
- Keep insights concise (one sentence each)
- Focus on what the data shows, not what could be done

Respond ONLY with valid JSON, no additional text.`
}

function parseInsightResponse(text: string): LLMInsightsResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in response")
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate structure
    return {
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 2) : [],
      nextActions: Array.isArray(parsed.nextActions)
        ? parsed.nextActions.slice(0, 2).map((a: { label?: string; intentPatch?: unknown[] }) => ({
            label: a.label || "Explore further",
            intentPatch: Array.isArray(a.intentPatch) ? a.intentPatch : [],
          }))
        : [],
    }
  } catch {
    // Return fallback on parse error
    return {
      insights: [
        "The visualization reveals patterns in the data.",
        "Consider the distribution and outliers.",
        "Further exploration may uncover relationships.",
      ],
      warnings: [],
      nextActions: [],
    }
  }
}
