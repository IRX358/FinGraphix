import { NextResponse } from "next/server"
import { getDataset } from "@/lib/dataset-store"
import type { VisSpec, DrillDownOption } from "@/lib/types"
import {
  generateHistogram,
  generateBarChart,
  generateScatter,
  createVisSpec,
  buildIntent,
} from "@/lib/chart-generator"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { datasetId, currentVis, drillDownOption } = body as {
      datasetId: string
      currentVis: VisSpec
      drillDownOption: DrillDownOption
    }

    if (!datasetId || !currentVis || !drillDownOption) {
      return NextResponse.json(
        { error: "datasetId, currentVis, and drillDownOption are required" },
        { status: 400 }
      )
    }

    const dataset = getDataset(datasetId)
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    const { profile, rows } = dataset
    const charts: VisSpec[] = []
    let chartId = 0

    const xClause = currentVis.intent.clauses.find((c) => c.role === "x")
    const yClause = currentVis.intent.clauses.find((c) => c.role === "y")
    const colorClause = currentVis.intent.clauses.find((c) => c.role === "color")
    const filterClauses = currentVis.intent.clauses.filter((c) => c.role === "filter")

    const xField = xClause?.field
    const yField = yClause?.field

    switch (drillDownOption.type) {
      case "breakdown": {
        // Add color grouping by the specified field
        const colorField = drillDownOption.field
        if (!colorField) break

        const colorCol = profile.columns.find((c) => c.name === colorField)
        if (!colorCol) break

        // Get unique values for the breakdown field
        const uniqueValues = [...new Set(rows.map((r) => String(r[colorField])))]
          .filter((v) => v !== "undefined" && v !== "null")
          .slice(0, 10)

        // Generate a chart with color encoding
        if (currentVis.chartType === "histogram" && xField) {
          const xCol = profile.columns.find((c) => c.name === xField)
          if (xCol) {
            const vegaLite = generateHistogram(xCol, rows, colorField)
            charts.push(
              createVisSpec(
                `drill-${chartId++}`,
                `${xField} by ${colorField}`,
                "histogram",
                vegaLite,
                1,
                buildIntent(xField, undefined, colorField, filterClauses)
              )
            )
          }
        } else if (currentVis.chartType === "scatter" && xField && yField) {
          const xCol = profile.columns.find((c) => c.name === xField)
          const yCol = profile.columns.find((c) => c.name === yField)
          if (xCol && yCol) {
            const vegaLite = generateScatter(xCol, yCol, rows, colorField)
            charts.push(
              createVisSpec(
                `drill-${chartId++}`,
                `${xField} vs ${yField} by ${colorField}`,
                "scatter",
                vegaLite,
                1,
                buildIntent(xField, yField, colorField, filterClauses)
              )
            )
          }
        } else if (currentVis.chartType === "bar" && xField) {
          const xCol = profile.columns.find((c) => c.name === xField)
          if (xCol) {
            const vegaLite = generateBarChart(xCol, rows, colorField)
            charts.push(
              createVisSpec(
                `drill-${chartId++}`,
                `${xField} by ${colorField}`,
                "bar",
                vegaLite,
                1,
                buildIntent(xField, undefined, colorField, filterClauses)
              )
            )
          }
        }

        // Also generate individual charts for top values
        for (const value of uniqueValues.slice(0, 4)) {
          const filteredData = rows.filter((r) => String(r[colorField]) === value)
          if (filteredData.length < 5) continue

          const newFilter = { field: colorField, role: "filter" as const, op: "=" as const, value }

          if (currentVis.chartType === "histogram" && xField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            if (xCol) {
              const vegaLite = generateHistogram(xCol, filteredData)
              charts.push(
                createVisSpec(
                  `drill-${chartId++}`,
                  `${xField} for ${colorField}=${value}`,
                  "histogram",
                  vegaLite,
                  0.8,
                  buildIntent(xField, undefined, undefined, [...filterClauses, newFilter])
                )
              )
            }
          } else if (currentVis.chartType === "bar" && xField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            if (xCol) {
              const vegaLite = generateBarChart(xCol, filteredData)
              charts.push(
                createVisSpec(
                  `drill-${chartId++}`,
                  `${xField} for ${colorField}=${value}`,
                  "bar",
                  vegaLite,
                  0.8,
                  buildIntent(xField, undefined, undefined, [...filterClauses, newFilter])
                )
              )
            }
          }
        }
        break
      }

      case "filter": {
        // Filter to specific value(s)
        const filterField = drillDownOption.field
        const filterValue = drillDownOption.value
        if (!filterField) break

        const filterCol = profile.columns.find((c) => c.name === filterField)
        if (!filterCol) break

        // Get top values to filter by
        const valuesToFilter = filterValue
          ? [String(filterValue)]
          : (filterCol.topValues?.slice(0, 5).map((v) => v.value) || [])

        for (const value of valuesToFilter) {
          const filteredData = rows.filter((r) => String(r[filterField]) === value)
          if (filteredData.length < 5) continue

          const newFilter = { field: filterField, role: "filter" as const, op: "=" as const, value }

          if (currentVis.chartType === "histogram" && xField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            if (xCol) {
              const vegaLite = generateHistogram(xCol, filteredData, colorClause?.field)
              charts.push(
                createVisSpec(
                  `drill-${chartId++}`,
                  `${xField} where ${filterField}=${value}`,
                  "histogram",
                  vegaLite,
                  1,
                  buildIntent(xField, undefined, colorClause?.field, [...filterClauses, newFilter])
                )
              )
            }
          } else if (currentVis.chartType === "scatter" && xField && yField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            const yCol = profile.columns.find((c) => c.name === yField)
            if (xCol && yCol) {
              const vegaLite = generateScatter(xCol, yCol, filteredData, colorClause?.field)
              charts.push(
                createVisSpec(
                  `drill-${chartId++}`,
                  `${xField} vs ${yField} where ${filterField}=${value}`,
                  "scatter",
                  vegaLite,
                  1,
                  buildIntent(xField, yField, colorClause?.field, [...filterClauses, newFilter])
                )
              )
            }
          } else if (currentVis.chartType === "bar" && xField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            if (xCol) {
              const vegaLite = generateBarChart(xCol, filteredData, colorClause?.field)
              charts.push(
                createVisSpec(
                  `drill-${chartId++}`,
                  `${xField} where ${filterField}=${value}`,
                  "bar",
                  vegaLite,
                  1,
                  buildIntent(xField, undefined, colorClause?.field, [...filterClauses, newFilter])
                )
              )
            }
          }
        }
        break
      }

      case "compare": {
        // Create comparison charts with another dimension
        const compareField = drillDownOption.field
        const secondaryField = drillDownOption.secondaryField
        if (!compareField) break

        const compareCol = profile.columns.find((c) => c.name === compareField)
        if (!compareCol) break

        // If comparing with a numeric field, create scatter plot
        if (compareCol.type === "number" && xField) {
          const xCol = profile.columns.find((c) => c.name === xField)
          if (xCol && xCol.type === "number") {
            const vegaLite = generateScatter(xCol, compareCol, rows, colorClause?.field)
            charts.push(
              createVisSpec(
                `drill-${chartId++}`,
                `${xField} vs ${compareField}`,
                "scatter",
                vegaLite,
                1,
                buildIntent(xField, compareField, colorClause?.field, filterClauses)
              )
            )
          }
        }

        // If comparing with categorical, show distribution of compare field
        if (compareCol.type === "category") {
          const vegaLite = generateBarChart(compareCol, rows)
          charts.push(
            createVisSpec(
              `drill-${chartId++}`,
              `Distribution of ${compareField}`,
              "bar",
              vegaLite,
              0.9,
              buildIntent(compareField, undefined, undefined, filterClauses)
            )
          )

          // Cross-tabulation: original field colored by compare field
          if (xField) {
            const xCol = profile.columns.find((c) => c.name === xField)
            if (xCol) {
              if (currentVis.chartType === "histogram") {
                const vegaLite = generateHistogram(xCol, rows, compareField)
                charts.push(
                  createVisSpec(
                    `drill-${chartId++}`,
                    `${xField} by ${compareField}`,
                    "histogram",
                    vegaLite,
                    0.9,
                    buildIntent(xField, undefined, compareField, filterClauses)
                  )
                )
              } else if (currentVis.chartType === "bar") {
                const vegaLite = generateBarChart(xCol, rows, compareField)
                charts.push(
                  createVisSpec(
                    `drill-${chartId++}`,
                    `${xField} by ${compareField}`,
                    "bar",
                    vegaLite,
                    0.9,
                    buildIntent(xField, undefined, compareField, filterClauses)
                  )
                )
              }
            }
          }
        }

        // If secondary field specified, create that comparison too
        if (secondaryField) {
          const secondCol = profile.columns.find((c) => c.name === secondaryField)
          if (secondCol && compareCol.type === "number" && secondCol.type === "number") {
            const vegaLite = generateScatter(compareCol, secondCol, rows, colorClause?.field)
            charts.push(
              createVisSpec(
                `drill-${chartId++}`,
                `${compareField} vs ${secondaryField}`,
                "scatter",
                vegaLite,
                0.8,
                buildIntent(compareField, secondaryField, colorClause?.field, filterClauses)
              )
            )
          }
        }
        break
      }
    }

    return NextResponse.json({ charts: charts.slice(0, 6) })
  } catch (error) {
    console.error("Drill-down recommendation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
