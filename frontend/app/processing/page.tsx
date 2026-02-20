"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FinancialLoading } from "@/components/financial-loading"

function ProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resultId = searchParams.get("resultId")
  const datasetId = searchParams.get("datasetId")

  useEffect(() => {
    // If we have a resultId, redirect to dashboard
    if (resultId) {
      const timer = setTimeout(() => {
        router.replace(`/dashboard?resultId=${resultId}`)
      }, 2500)
      return () => clearTimeout(timer)
    }

    // Legacy fallback: if datasetId is provided
    if (datasetId) {
      const timer = setTimeout(() => {
        router.replace(`/explore?datasetId=${datasetId}`)
      }, 3500)
      return () => clearTimeout(timer)
    }

    // No ID provided, go home
    router.replace("/")
  }, [resultId, datasetId, router])

  return <FinancialLoading />
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<FinancialLoading />}>
      <ProcessingContent />
    </Suspense>
  )
}
