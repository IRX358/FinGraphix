"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FinancialLoading } from "@/components/financial-loading"

import { API_BASE } from "@/lib/config"

function ProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resultId = searchParams.get("resultId")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resultId) {
      router.replace("/")
      return
    }

    let attempts = 0
    const maxAttempts = 30

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/results/${resultId}`)
        if (res.ok) {
          // Results are ready — redirect to results page
          router.replace(`/results?resultId=${resultId}`)
          return
        }
        if (res.status === 404 && attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 1000)
          return
        }
        throw new Error("Analysis timed out")
      } catch (err) {
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 1000)
        } else {
          setError("Analysis is taking longer than expected. Please try again.")
        }
      }
    }

    // Start polling after a brief delay to show the animation
    const timer = setTimeout(poll, 1500)
    return () => clearTimeout(timer)
  }, [resultId, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <FinancialLoading />
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<FinancialLoading />}>
      <ProcessingContent />
    </Suspense>
  )
}
