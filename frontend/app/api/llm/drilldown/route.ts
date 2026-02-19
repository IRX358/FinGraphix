import { NextResponse } from "next/server"
import { generateText } from "ai"
import type { VisSpec, DrillDownOption } from "@/lib/types"

interface DrillDownInsights {
  summary: string
  keyFindings: string[]
  drillDownOptions: DrillDownOption[]
  relatedQuestions: string[]
}

interface ProfileSummary {
  rowCount: number
  columns: Array<{ name: string; type: string; cardinality: number }>
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { datasetId, visSpec, profile } = body as {
      datasetId: string
      visSpec: VisSpec
      profile: ProfileSummary
    }

    if (!datasetId || !visSpec || !profile) {
      return NextResponse.json(
        { error: "datasetId, visSpec, and profile are required" },
        { status: 400 }
      )
    }

    // Build prompt for drill-down suggestions
    const prompt = buildDrillDownPrompt(visSpec, profile)

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      maxTokens: 1500,
    })

    const insights = parseDrillDownResponse(text, visSpec, profile)

    return NextResponse.json(insights)
  } catch (error) {
    console.error("Drill-down insights error:", error)

    // Return fallback
    return NextResponse.json({
      summary: "This visualization shows the distribution of your data.",
      keyFindings: ["The data reveals interesting patterns worth exploring."],
      drillDownOptions: [],
      relatedQuestions: ["What factors might influence this distribution?"],
    })
  }
}

function buildDrillDownPrompt(visSpec: VisSpec, profile: ProfileSummary): string {
  const xClause = visSpec.intent.clauses.find((c) => c.role === "x")
  const yClause = visSpec.intent.clauses.find((c) => c.role === "y")
  const colorClause = visSpec.intent.clauses.find((c) => c.role === "color")
  const filterClauses = visSpec.intent.clauses.filter((c) => c.role === "filter")

  const currentFields = [xClause?.field, yClause?.field, colorClause?.field].filter(Boolean)
  const availableColumns = profile.columns.filter(
    (c) => !currentFields.includes(c.name) && c.cardinality > 1 && c.cardinality <= 50
  )

  const categoricalCols = availableColumns.filter((c) => c.type === "category")
  const numericCols = availableColumns.filter((c) => c.type === "number")

  return `You are a data analyst assistant. Analyze this chart and suggest meaningful drill-down explorations.

CURRENT CHART:
- Title: ${visSpec.title}
- Type: ${visSpec.chartType}
- X-axis: ${xClause?.field || "none"}
- Y-axis: ${yClause?.field || "none"}
- Color grouping: ${colorClause?.field || "none"}
- Current filters: ${filterClauses.length > 0 ? filterClauses.map((f) => `${f.field}=${f.value}`).join(", ") : "none"}

DATASET INFO:
- Total rows: ${profile.rowCount}
- Available categorical columns for breakdown: ${categoricalCols.map((c) => `${c.name} (${c.cardinality} values)`).join(", ") || "none"}
- Available numeric columns: ${numericCols.map((c) => c.name).join(", ") || "none"}

Respond with a JSON object in this exact format:
{
  "summary": "A 1-2 sentence summary of what this chart reveals",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "drillDownOptions": [
    {
      "type": "breakdown",
      "label": "Break down by ColumnName",
      "description": "See how the distribution varies across different ColumnName values",
      "field": "ColumnName"
    },
    {
      "type": "filter",
      "label": "Focus on specific segment",
      "description": "Filter to see just one part of the data",
      "field": "ColumnName",
      "value": "specific_value"
    },
    {
      "type": "compare",
      "label": "Compare with AnotherColumn",
      "description": "See how this relates to another dimension",
      "field": "AnotherColumn",
      "secondaryField": "OptionalSecondField"
    }
  ],
  "relatedQuestions": ["Question 1?", "Question 2?"]
}

IMPORTANT:
- For "breakdown" type: suggest adding a color grouping by a categorical column
- For "filter" type: suggest filtering to interesting subsets (use actual column names from the dataset)
- For "compare" type: suggest scatter plots or cross-comparisons with other columns
- Provide 3-5 drill-down options that would genuinely help understand the data
- Only suggest fields that exist in the available columns
- Make descriptions actionable and specific

Respond ONLY with valid JSON, no additional text.`
}

function parseDrillDownResponse(
  text: string,
  visSpec: VisSpec,
  profile: ProfileSummary
): DrillDownInsights {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and filter drill-down options to only include valid fields
    const validFields = new Set(profile.columns.map((c) => c.name))
    const validDrillDowns = (parsed.drillDownOptions || [])
      .filter((opt: DrillDownOption) => {
        if (opt.field && !validFields.has(opt.field)) return false
        if (opt.secondaryField && !validFields.has(opt.secondaryField)) return false
        return true
      })
      .slice(0, 5)

    return {
      summary: parsed.summary || "This visualization shows patterns in your data.",
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.slice(0, 4) : [],
      drillDownOptions: validDrillDowns,
      relatedQuestions: Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions.slice(0, 3) : [],
    }
  } catch {
    // Generate fallback based on available columns
    const currentFields = visSpec.intent.clauses.map((c) => c.field)
    const availableCategorical = profile.columns.filter(
      (c) => c.type === "category" && !currentFields.includes(c.name) && c.cardinality <= 20
    )

    const fallbackDrillDowns: DrillDownOption[] = availableCategorical.slice(0, 3).map((col) => ({
      type: "breakdown" as const,
      label: `Break down by ${col.name}`,
      description: `See how the distribution varies across ${col.name}`,
      field: col.name,
    }))

    return {
      summary: "This visualization reveals patterns in your data.",
      keyFindings: ["The data shows an interesting distribution."],
      drillDownOptions: fallbackDrillDowns,
      relatedQuestions: ["What factors might explain these patterns?"],
    }
  }
}
