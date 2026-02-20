"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FinancialLoading } from "@/components/financial-loading"

function ProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const datasetId = searchParams.get("datasetId")

  useEffect(() => {
    if (!datasetId) {
      router.replace("/")
      return
    }

    // Show the processing animation for a minimum duration then redirect
    const timer = setTimeout(() => {
      router.replace(`/explore?datasetId=${datasetId}`)
    }, 3500)

    return () => clearTimeout(timer)
  }, [datasetId, router])

  return <FinancialLoading />
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<FinancialLoading />}>
      <ProcessingContent />
    </Suspense>
  )
}
