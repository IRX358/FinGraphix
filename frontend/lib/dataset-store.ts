import type { StoredDataset } from "./types"

// In-memory store for datasets (singleton)
const datasetStore = new Map<string, StoredDataset>()

export function getDataset(datasetId: string): StoredDataset | undefined {
  return datasetStore.get(datasetId)
}

export function setDataset(dataset: StoredDataset): void {
  datasetStore.set(dataset.datasetId, dataset)
}

export function deleteDataset(datasetId: string): boolean {
  return datasetStore.delete(datasetId)
}

export function hasDataset(datasetId: string): boolean {
  return datasetStore.has(datasetId)
}
