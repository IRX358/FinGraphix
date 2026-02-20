"use client"

import React from "react"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBackendUrl } from "@/lib/api"

const MAX_SIZE_MB = 20

export function UploadDropzone() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState("")

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setIsUploading(true)
    setUploadProgress("Uploading CSV...")

    try {
      // Validate file
      if (!file.name.endsWith(".csv")) {
        throw new Error("Please upload a CSV file")
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`File size exceeds ${MAX_SIZE_MB}MB limit`)
      }

      // Upload file to FastAPI backend
      const formData = new FormData()
      formData.append("file", file)

      setUploadProgress("Analyzing transactions...")

      const response = await fetch(getBackendUrl("/api/analyze"), {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: "Analysis failed" }))
        throw new Error(data.detail || data.error || "Failed to analyze file")
      }

      const data = await response.json()
      
      setUploadProgress("Loading dashboard...")

      // Redirect to the dashboard with the result ID
      router.push(`/dashboard?resultId=${data.result_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
      setUploadProgress("")
    }
  }, [router])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  return (
    <Card
      className={cn(
        "border border-dashed rounded-xl",
        "bg-white/[0.04] backdrop-blur-sm",
        "animate-border-glow micro-hover",
        "hover:bg-white/[0.06]",
        isDragging && "border-primary bg-primary/10 scale-[1.02]",
        error && "border-destructive shadow-none",
        !isDragging && !error && "border-white/[0.12]"
      )}
      style={{ borderRadius: "12px" }}
    >
      <CardContent className="p-0">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="flex flex-col items-center justify-center gap-4 p-12"
        >
          {isUploading ? (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-muted-foreground">{uploadProgress || "Processing your file..."}</p>
            </>
          ) : (
            <>
              <div className={cn(
                "rounded-full p-4 transition-colors",
                isDragging ? "bg-primary/20" : "bg-white/[0.06]",
                error && "bg-destructive/10"
              )}>
                {error ? (
                  <AlertCircle className="h-8 w-8 text-destructive" />
                ) : isDragging ? (
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                ) : (
                  <Upload className="h-8 w-8" style={{ color: "rgba(255,255,255,0.45)" }} />
                )}
              </div>

              <div className="text-center">
                <p className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {isDragging ? "Drop your CSV file here" : "Upload Transaction CSV"}
                </p>
                <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Required: transaction_id, sender_id, receiver_id, amount, timestamp
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex flex-col items-center gap-2">
                <label>
                  <Button variant="outline" asChild disabled={isUploading} className="border-white/[0.15] hover:bg-white/[0.08] hover:border-white/[0.25] bg-transparent text-white/80">
                    <span className="cursor-pointer">
                      Choose File
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileInput}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </span>
                  </Button>
                </label>

                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Max {MAX_SIZE_MB}MB · CSV format only
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
