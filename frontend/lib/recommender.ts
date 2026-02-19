import type { DatasetProfile, ColumnProfile, VisSpec, Clause, Intent } from "./types"
import {
  generateHistogram,
  generateBarChart,
  generateScatter,
  generateLineChart,
  createVisSpec,
  buildIntent,
} from "./chart-generator"

// Calculate Pearson correlation coefficient
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n === 0) return 0

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return numerator / denominator
}

// Calculate variance of numeric array
function variance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
}

// Calculate skewness
function skewness(values: number[]): number {
  if (values.length === 0) return 0
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const std = Math.sqrt(variance(values))
  if (std === 0) return 0

  const cubedDiffs = values.map((v) => Math.pow((v - mean) / std, 3))
  return cubedDiffs.reduce((a, b) => a + b, 0) / n
}

// Calculate Gini impurity for categorical distribution
function giniImpurity(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  const probabilities = counts.map((c) => c / total)
  return 1 - probabilities.reduce((sum, p) => sum + p * p, 0)
}

// Generate overview charts
export function generateOverview(
  profile: DatasetProfile,
  rows: Record<string, unknown>[]
): VisSpec[] {
  const charts: VisSpec[] = []
  let chartId = 0

  // Get numeric columns ranked by variance * (1 - missingPct)
  const numericColumns = profile.columns
    .filter((c) => c.type === "number")
    .map((col) => {
      const values = rows
        .map((r) => r[col.name])
        .filter((v): v is number => typeof v === "number")
      const score = variance(values) * (1 - col.missingPct)
      return { col, score, values }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  // Generate histograms for top numeric columns
  for (const { col, values } of numericColumns) {
    const skew = Math.abs(skewness(values))
    const vegaLite = generateHistogram(col, rows)
    charts.push(
      createVisSpec(
        `hist-${chartId++}`,
        `Distribution of ${col.name}`,
        "histogram",
        vegaLite,
        skew,
        buildIntent(col.name)
      )
    )
  }

  // Get categorical columns ranked by (1 - missingPct) * (1/cardinality) with cardinality in [2..50]
  const categoricalColumns = profile.columns
    .filter((c) => c.type === "category" && c.cardinality >= 2 && c.cardinality <= 50)
    .map((col) => {
      const score = (1 - col.missingPct) * (1 / col.cardinality)
      return { col, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  // Generate bar charts for top categorical columns
  for (const { col } of categoricalColumns) {
    const counts = col.topValues?.map((v) => v.count) || []
    const gini = giniImpurity(counts)
    const vegaLite = generateBarChart(col, rows)
    charts.push(
      createVisSpec(
        `bar-${chartId++}`,
        `${col.name} Distribution`,
        "bar",
        vegaLite,
        gini,
        buildIntent(col.name)
      )
    )
  }

  // Get top 4 numeric pairs by Pearson correlation
  const numericCols = profile.columns.filter((c) => c.type === "number")
  const pairs: Array<{ x: ColumnProfile; y: ColumnProfile; corr: number }> = []

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const xValues = rows
        .map((r) => r[numericCols[i].name])
        .filter((v): v is number => typeof v === "number")
      const yValues = rows
        .map((r) => r[numericCols[j].name])
        .filter((v): v is number => typeof v === "number")

      // Ensure we have paired values
      const pairedX: number[] = []
      const pairedY: number[] = []
      for (let k = 0; k < rows.length; k++) {
        const x = rows[k][numericCols[i].name]
        const y = rows[k][numericCols[j].name]
        if (typeof x === "number" && typeof y === "number") {
          pairedX.push(x)
          pairedY.push(y)
        }
      }

      const corr = Math.abs(pearsonCorrelation(pairedX, pairedY))
      pairs.push({ x: numericCols[i], y: numericCols[j], corr })
    }
  }

  const topPairs = pairs.sort((a, b) => b.corr - a.corr).slice(0, 4)

  for (const { x, y, corr } of topPairs) {
    const vegaLite = generateScatter(x, y, rows)
    charts.push(
      createVisSpec(
        `scatter-${chartId++}`,
        `${x.name} vs ${y.name}`,
        "scatter",
        vegaLite,
        corr,
        buildIntent(x.name, y.name)
      )
    )
  }

  // Sort by score and limit to 12
  return charts.sort((a, b) => b.score - a.score).slice(0, 12)
}

// Generate enhanced charts (add color/group dimension)
export function generateEnhanced(
  profile: DatasetProfile,
  rows: Record<string, unknown>[],
  selectedVis: VisSpec
): VisSpec[] {
  const charts: VisSpec[] = []
  let chartId = 0

  // Find categorical columns suitable for color encoding
  const colorCandidates = profile.columns
    .filter((c) => c.type === "category" && c.cardinality >= 2 && c.cardinality <= 20)
    .slice(0, 5)

  // Get x and y fields from current intent
  const xClause = selectedVis.intent.clauses.find((c) => c.role === "x")
  const yClause = selectedVis.intent.clauses.find((c) => c.role === "y")
  const currentColorClause = selectedVis.intent.clauses.find((c) => c.role === "color")

  // Skip if already has color
  if (currentColorClause) return []

  const xField = xClause?.field
  const yField = yClause?.field

  for (const colorCol of colorCandidates) {
    // Skip if color field is already used as x or y
    if (colorCol.name === xField || colorCol.name === yField) continue

    let vegaLite: object
    let title: string

    if (selectedVis.chartType === "histogram" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (!xCol) continue
      vegaLite = generateHistogram(xCol, rows, colorCol.name)
      title = `${xField} by ${colorCol.name}`
    } else if (selectedVis.chartType === "scatter" && xField && yField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      const yCol = profile.columns.find((c) => c.name === yField)
      if (!xCol || !yCol) continue
      vegaLite = generateScatter(xCol, yCol, rows, colorCol.name)
      title = `${xField} vs ${yField} by ${colorCol.name}`
    } else if (selectedVis.chartType === "bar" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (!xCol) continue
      vegaLite = generateBarChart(xCol, rows, colorCol.name)
      title = `${xField} by ${colorCol.name}`
    } else {
      continue
    }

    // Score based on cardinality (prefer smaller)
    const score = 1 / colorCol.cardinality

    charts.push(
      createVisSpec(
        `enhance-${chartId++}`,
        title,
        selectedVis.chartType,
        vegaLite,
        score,
        buildIntent(xField, yField, colorCol.name)
      )
    )
  }

  return charts.sort((a, b) => b.score - a.score).slice(0, 15)
}

// Generate filtered charts
export function generateFiltered(
  profile: DatasetProfile,
  rows: Record<string, unknown>[],
  selectedVis: VisSpec
): VisSpec[] {
  const charts: VisSpec[] = []
  let chartId = 0

  // Find categorical columns suitable for filtering
  const filterCandidates = profile.columns
    .filter((c) => c.type === "category" && c.cardinality >= 2 && c.cardinality <= 20)
    .slice(0, 5)

  // Get current intent fields
  const xClause = selectedVis.intent.clauses.find((c) => c.role === "x")
  const yClause = selectedVis.intent.clauses.find((c) => c.role === "y")
  const colorClause = selectedVis.intent.clauses.find((c) => c.role === "color")
  const existingFilters = selectedVis.intent.clauses.filter((c) => c.role === "filter")

  const xField = xClause?.field
  const yField = yClause?.field
  const colorField = colorClause?.field

  for (const filterCol of filterCandidates) {
    // Skip if already filtered on this column
    if (existingFilters.some((f) => f.field === filterCol.name)) continue
    // Skip if used as x, y, or color
    if (filterCol.name === xField || filterCol.name === yField || filterCol.name === colorField) continue

    // Get top 3 values
    const topValues = filterCol.topValues?.slice(0, 3) || []

    for (const { value } of topValues) {
      // Filter data
      const filteredData = rows.filter((r) => String(r[filterCol.name]) === value)
      if (filteredData.length === 0) continue

      let vegaLite: object
      let title: string

      const filterClause: Clause = {
        field: filterCol.name,
        role: "filter",
        op: "=",
        value,
      }

      if (selectedVis.chartType === "histogram" && xField) {
        const xCol = profile.columns.find((c) => c.name === xField)
        if (!xCol) continue
        vegaLite = generateHistogram(xCol, filteredData, colorField)
        title = `${xField} where ${filterCol.name}=${value}`
      } else if (selectedVis.chartType === "scatter" && xField && yField) {
        const xCol = profile.columns.find((c) => c.name === xField)
        const yCol = profile.columns.find((c) => c.name === yField)
        if (!xCol || !yCol) continue
        vegaLite = generateScatter(xCol, yCol, filteredData, colorField)
        title = `${xField} vs ${yField} (${filterCol.name}=${value})`
      } else if (selectedVis.chartType === "bar" && xField) {
        const xCol = profile.columns.find((c) => c.name === xField)
        if (!xCol) continue
        vegaLite = generateBarChart(xCol, filteredData, colorField)
        title = `${xField} where ${filterCol.name}=${value}`
      } else {
        continue
      }

      // Score based on data size ratio (prefer more impactful filters)
      const ratio = filteredData.length / rows.length
      const score = Math.abs(ratio - 0.5) // Prefer ~50% filters

      charts.push(
        createVisSpec(
          `filter-${chartId++}`,
          title,
          selectedVis.chartType,
          vegaLite,
          score,
          buildIntent(xField, yField, colorField, [...existingFilters, filterClause])
        )
      )
    }
  }

  return charts.sort((a, b) => b.score - a.score).slice(0, 15)
}

// Generate generalized charts (zoom out)
export function generateGeneralized(
  profile: DatasetProfile,
  rows: Record<string, unknown>[],
  selectedVis: VisSpec
): VisSpec[] {
  const charts: VisSpec[] = []
  let chartId = 0

  const xClause = selectedVis.intent.clauses.find((c) => c.role === "x")
  const yClause = selectedVis.intent.clauses.find((c) => c.role === "y")
  const colorClause = selectedVis.intent.clauses.find((c) => c.role === "color")
  const filterClauses = selectedVis.intent.clauses.filter((c) => c.role === "filter")

  const xField = xClause?.field
  const yField = yClause?.field

  // Remove filter if present
  if (filterClauses.length > 0) {
    const remainingFilters = filterClauses.slice(0, -1)
    let filteredData = rows

    for (const filter of remainingFilters) {
      filteredData = filteredData.filter((r) => {
        if (filter.op === "=") return String(r[filter.field]) === String(filter.value)
        return true
      })
    }

    let vegaLite: object
    let title: string

    if (selectedVis.chartType === "histogram" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (xCol) {
        vegaLite = generateHistogram(xCol, filteredData, colorClause?.field)
        title = remainingFilters.length > 0 
          ? `${xField} (fewer filters)`
          : `${xField} (all data)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "histogram",
            vegaLite,
            0.5,
            buildIntent(xField, undefined, colorClause?.field, remainingFilters)
          )
        )
      }
    } else if (selectedVis.chartType === "scatter" && xField && yField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      const yCol = profile.columns.find((c) => c.name === yField)
      if (xCol && yCol) {
        vegaLite = generateScatter(xCol, yCol, filteredData, colorClause?.field)
        title = remainingFilters.length > 0
          ? `${xField} vs ${yField} (fewer filters)`
          : `${xField} vs ${yField} (all data)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "scatter",
            vegaLite,
            0.5,
            buildIntent(xField, yField, colorClause?.field, remainingFilters)
          )
        )
      }
    } else if (selectedVis.chartType === "bar" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (xCol) {
        vegaLite = generateBarChart(xCol, filteredData, colorClause?.field)
        title = remainingFilters.length > 0
          ? `${xField} (fewer filters)`
          : `${xField} (all data)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "bar",
            vegaLite,
            0.5,
            buildIntent(xField, undefined, colorClause?.field, remainingFilters)
          )
        )
      }
    }
  }

  // Remove color if present
  if (colorClause) {
    let vegaLite: object
    let title: string

    if (selectedVis.chartType === "histogram" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (xCol) {
        vegaLite = generateHistogram(xCol, rows)
        title = `${xField} (no grouping)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "histogram",
            vegaLite,
            0.5,
            buildIntent(xField, undefined, undefined, filterClauses)
          )
        )
      }
    } else if (selectedVis.chartType === "scatter" && xField && yField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      const yCol = profile.columns.find((c) => c.name === yField)
      if (xCol && yCol) {
        vegaLite = generateScatter(xCol, yCol, rows)
        title = `${xField} vs ${yField} (no grouping)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "scatter",
            vegaLite,
            0.5,
            buildIntent(xField, yField, undefined, filterClauses)
          )
        )
      }
    } else if (selectedVis.chartType === "bar" && xField) {
      const xCol = profile.columns.find((c) => c.name === xField)
      if (xCol) {
        vegaLite = generateBarChart(xCol, rows)
        title = `${xField} (no grouping)`
        charts.push(
          createVisSpec(
            `general-${chartId++}`,
            title,
            "bar",
            vegaLite,
            0.5,
            buildIntent(xField, undefined, undefined, filterClauses)
          )
        )
      }
    }
  }

  // If scatter, create histograms of x and y
  if (selectedVis.chartType === "scatter" && xField && yField) {
    const xCol = profile.columns.find((c) => c.name === xField)
    const yCol = profile.columns.find((c) => c.name === yField)

    if (xCol) {
      const vegaLite = generateHistogram(xCol, rows)
      charts.push(
        createVisSpec(
          `general-${chartId++}`,
          `Distribution of ${xField}`,
          "histogram",
          vegaLite,
          0.4,
          buildIntent(xField)
        )
      )
    }

    if (yCol) {
      const vegaLite = generateHistogram(yCol, rows)
      charts.push(
        createVisSpec(
          `general-${chartId++}`,
          `Distribution of ${yField}`,
          "histogram",
          vegaLite,
          0.4,
          buildIntent(yField)
        )
      )
    }
  }

  return charts.slice(0, 15)
}
