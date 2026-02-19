import type { ColumnProfile, ColumnType, DatasetProfile } from "./types"

// Constants
const MAX_ROWS = 50000
const SAMPLE_SIZE = 5000
const TOP_VALUES_LIMIT = 20

// Parse CSV string into rows
export function parseCSV(csvText: string): Record<string, unknown>[] {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return []

  // Parse header
  const headers = parseCSVLine(lines[0])
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const row: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      row[header] = parseValue(values[idx])
    })
    rows.push(row)
  }

  return rows
}

// Parse a single CSV line handling quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

// Parse a value to number, date, or string
function parseValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "na" || trimmed.toLowerCase() === "nan") {
    return null
  }

  // Try number
  const num = Number(trimmed)
  if (!isNaN(num) && trimmed !== "") {
    return num
  }

  // Try date
  const date = new Date(trimmed)
  if (!isNaN(date.getTime()) && trimmed.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) {
    return date
  }

  return trimmed
}

// Detect column type from values
function detectColumnType(values: unknown[]): ColumnType {
  const nonNull = values.filter((v) => v !== null && v !== undefined)
  if (nonNull.length === 0) return "unknown"

  let numCount = 0
  let dateCount = 0

  for (const val of nonNull.slice(0, 100)) {
    if (typeof val === "number") numCount++
    else if (val instanceof Date) dateCount++
  }

  const sampleSize = Math.min(nonNull.length, 100)
  if (numCount / sampleSize > 0.8) return "number"
  if (dateCount / sampleSize > 0.8) return "date"
  return "category"
}

// Calculate statistics for a numeric column
function calcNumericStats(values: number[]): { mean: number; std: number; min: number; max: number } {
  if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 }

  const n = values.length
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const min = Math.min(...values)
  const max = Math.max(...values)

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n
  const std = Math.sqrt(variance)

  return { mean, std, min, max }
}

// Get top values for a categorical column
function getTopValues(values: unknown[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()

  for (const val of values) {
    if (val === null || val === undefined) continue
    const key = String(val)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_VALUES_LIMIT)
    .map(([value, count]) => ({ value, count }))
}

// Profile a single column
function profileColumn(name: string, values: unknown[]): ColumnProfile {
  const type = detectColumnType(values)
  const nonNullCount = values.filter((v) => v !== null && v !== undefined).length
  const missingPct = (values.length - nonNullCount) / values.length

  const uniqueValues = new Set(values.filter((v) => v !== null && v !== undefined))
  const cardinality = uniqueValues.size

  const profile: ColumnProfile = {
    name,
    type,
    missingPct,
    cardinality,
  }

  if (type === "number") {
    const numericValues = values.filter((v): v is number => typeof v === "number")
    const stats = calcNumericStats(numericValues)
    profile.min = stats.min
    profile.max = stats.max
    profile.mean = stats.mean
    profile.std = stats.std
  }

  if (type === "category" || type === "date") {
    profile.topValues = getTopValues(values)
  }

  return profile
}

// Create dataset profile from rows
export function createProfile(datasetId: string, rows: Record<string, unknown>[]): DatasetProfile {
  if (rows.length === 0) {
    return {
      datasetId,
      rowCount: 0,
      colCount: 0,
      columns: [],
    }
  }

  const columnNames = Object.keys(rows[0])
  const columns: ColumnProfile[] = columnNames.map((name) => {
    const values = rows.map((row) => row[name])
    return profileColumn(name, values)
  })

  return {
    datasetId,
    rowCount: rows.length,
    colCount: columnNames.length,
    columns,
  }
}

// Sample rows from dataset
export function sampleRows(rows: Record<string, unknown>[], size: number = SAMPLE_SIZE): Record<string, unknown>[] {
  if (rows.length <= size) return rows

  const sampled: Record<string, unknown>[] = []
  const step = rows.length / size

  for (let i = 0; i < size; i++) {
    const idx = Math.floor(i * step)
    sampled.push(rows[idx])
  }

  return sampled
}

// Check if dataset is too large
export function isLargeDataset(rowCount: number): boolean {
  return rowCount > MAX_ROWS
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
