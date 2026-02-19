import type { StoredDataset } from "./types"

const STORAGE_KEY = "ai-data-scientist-dataset"

export function saveDatasetToLocalStorage(dataset: StoredDataset): void {
  if (typeof window === "undefined") return
  
  try {
    const serialized = JSON.stringify(dataset)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.warn("Failed to save dataset to localStorage:", error)
  }
}

export function getDatasetFromLocalStorage(): StoredDataset | null {
  if (typeof window === "undefined") return null
  
  try {
    const serialized = localStorage.getItem(STORAGE_KEY)
    if (!serialized) return null
    return JSON.parse(serialized) as StoredDataset
  } catch (error) {
    console.warn("Failed to load dataset from localStorage:", error)
    return null
  }
}

export function clearDatasetFromLocalStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function hasDatasetInLocalStorage(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) !== null
}
