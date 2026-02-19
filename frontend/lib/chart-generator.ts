import type { ColumnProfile, ChartType, VisSpec, Intent, Clause } from "./types"

// Generate a Vega-Lite histogram spec
export function generateHistogram(
  column: ColumnProfile,
  data: Record<string, unknown>[],
  colorField?: string
): object {
  const spec: Record<string, unknown> = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container",
    height: 200,
    data: { values: data },
    mark: { type: "bar", tooltip: true },
    encoding: {
      x: {
        bin: { maxbins: 20 },
        field: column.name,
        type: "quantitative",
        title: column.name,
      },
      y: {
        aggregate: "count",
        title: "Count",
      },
    },
  }

  if (colorField) {
    (spec.encoding as Record<string, unknown>).color = {
      field: colorField,
      type: "nominal",
      title: colorField,
    }
  }

  return spec
}

// Generate a Vega-Lite bar chart spec
export function generateBarChart(
  column: ColumnProfile,
  data: Record<string, unknown>[],
  colorField?: string
): object {
  // Aggregate data by category
  const counts = new Map<string, number>()
  for (const row of data) {
    const val = row[column.name]
    if (val === null || val === undefined) continue
    const key = String(val)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  // Sort by count and limit to top 20
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  const chartData = sorted.map(([category, count]) => ({
    [column.name]: category,
    count,
  }))

  const spec: Record<string, unknown> = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container",
    height: 200,
    data: { values: chartData },
    mark: { type: "bar", tooltip: true },
    encoding: {
      x: {
        field: column.name,
        type: "nominal",
        sort: "-y",
        title: column.name,
        axis: { labelAngle: -45 },
      },
      y: {
        field: "count",
        type: "quantitative",
        title: "Count",
      },
    },
  }

  if (colorField) {
    (spec.encoding as Record<string, unknown>).color = {
      field: colorField,
      type: "nominal",
      title: colorField,
    }
  }

  return spec
}

// Generate a Vega-Lite scatter plot spec
export function generateScatter(
  xColumn: ColumnProfile,
  yColumn: ColumnProfile,
  data: Record<string, unknown>[],
  colorField?: string
): object {
  // Sample data for scatter plot (max 2000 points)
  const sampledData = data.length > 2000 
    ? data.filter((_, i) => i % Math.ceil(data.length / 2000) === 0).slice(0, 2000)
    : data

  const spec: Record<string, unknown> = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container",
    height: 200,
    data: { values: sampledData },
    mark: { type: "point", tooltip: true, filled: true, opacity: 0.6 },
    encoding: {
      x: {
        field: xColumn.name,
        type: "quantitative",
        title: xColumn.name,
      },
      y: {
        field: yColumn.name,
        type: "quantitative",
        title: yColumn.name,
      },
    },
  }

  if (colorField) {
    (spec.encoding as Record<string, unknown>).color = {
      field: colorField,
      type: "nominal",
      title: colorField,
    }
  }

  return spec
}

// Generate a Vega-Lite line chart spec
export function generateLineChart(
  xColumn: ColumnProfile,
  yColumn: ColumnProfile,
  data: Record<string, unknown>[]
): object {
  // Sort by date
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[xColumn.name]
    const bVal = b[xColumn.name]
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime()
    }
    return String(aVal).localeCompare(String(bVal))
  })

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container",
    height: 200,
    data: { values: sortedData },
    mark: { type: "line", tooltip: true, point: true },
    encoding: {
      x: {
        field: xColumn.name,
        type: "temporal",
        title: xColumn.name,
      },
      y: {
        field: yColumn.name,
        type: "quantitative",
        title: yColumn.name,
      },
    },
  }
}

// Create a VisSpec from parameters
export function createVisSpec(
  id: string,
  title: string,
  chartType: ChartType,
  vegaLite: object,
  score: number,
  intent: Intent
): VisSpec {
  return {
    id,
    title,
    chartType,
    intent,
    vegaLite,
    score,
  }
}

// Build intent from chart parameters
export function buildIntent(
  xField?: string,
  yField?: string,
  colorField?: string,
  filters?: Clause[]
): Intent {
  const clauses: Clause[] = []

  if (xField) {
    clauses.push({ field: xField, role: "x" })
  }
  if (yField) {
    clauses.push({ field: yField, role: "y" })
  }
  if (colorField) {
    clauses.push({ field: colorField, role: "color" })
  }
  if (filters) {
    clauses.push(...filters)
  }

  return { clauses }
}
