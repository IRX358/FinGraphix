"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { FinancialLoading } from "@/components/financial-loading"
import { AlertCircle, Download, BarChart3, Users, Network, Clock, Shield, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RING_PALETTE } from "@/lib/constants"

import { API_BASE } from "@/lib/config"

// Dynamically import GraphVisualizer (it uses D3 which requires browser APIs)
const GraphVisualizer = dynamic(
  () => import("@/components/GraphVisualizer"),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center" style={{ background: "#080f1a", borderRadius: 12 }}><p style={{ color: "#4a7a9a" }}>Loading graph...</p></div> }
)

// ─── Risk badge colours ─────────────────────────────────────────────────────
function riskBadge(level: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: "rgba(255,58,92,0.15)", text: "#ff3a5c", border: "rgba(255,58,92,0.3)" },
    HIGH: { bg: "rgba(255,140,0,0.15)", text: "#ff8c00", border: "rgba(255,140,0,0.3)" },
    MEDIUM: { bg: "rgba(255,230,0,0.12)", text: "#ffe600", border: "rgba(255,230,0,0.25)" },
  }
  const s = map[level] || map.MEDIUM
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {level}
    </span>
  )
}

function patternBadge(p: string) {
  return (
    <span
      key={p}
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mr-1 mb-1"
      style={{ background: "rgba(79,156,255,0.12)", color: "#4f9cff", border: "1px solid rgba(79,156,255,0.2)" }}
    >
      {p.replace(/_/g, " ")}
    </span>
  )
}




function getSuspicionColor(score: number) {
  if (score >= 80) return "#ff3a5c"; // Critical
  if (score >= 60) return "#ff8c00"; // High
  return "#ffe600"; // Medium
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resultId = searchParams.get("resultId")

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!resultId) {
      router.push("/")
      return
    }

    const fetchResults = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/results/${resultId}`)
        if (!res.ok) throw new Error("Results not found")
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results")
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [resultId, router])

  const handleDownload = async () => {
    if (!resultId) return
    setIsDownloading(true)
    try {
      const response = await fetch(`${API_BASE}/api/download/${resultId}`)
      if (!response.ok) throw new Error("Download failed")
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `fingraphix_report_${resultId}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Download error:", err)
      alert("Failed to download report")
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) return <FinancialLoading />

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20" style={{ background: "#050505" }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold" style={{ color: "#f0f0f0" }}>Something went wrong</h2>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>{error || "Results not found"}</p>
          <Button asChild>
            <Link href="/">Upload a new file</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { suspicious_accounts, fraud_rings, summary, graph_data } = data
  const displayedAccounts = showAllAccounts ? suspicious_accounts : suspicious_accounts.slice(0, 10)

  return (
    <div className="min-h-screen animate-in fade-in duration-500 pt-24" style={{ background: "#050505" }}>

      {/* ─── Top bar ─── */}
      <div className="sticky top-0 z-30 mb-8" style={{ background: "rgba(5,5,5,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span className="text-sm font-medium" style={{ color: "#e0f0ff" }}>Analysis Complete</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(79,156,255,0.12)", color: "#4f9cff" }}>
              ID: {resultId}
            </span>
          </div>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            size="sm"
            className="gap-2"
            style={{ background: "rgba(34,197,94,0.15)",cursor: "pointer", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)"}}
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download Report"}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 space-y-8">

        {/* ─── Summary cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Accounts Analyzed", value: summary.total_accounts_analyzed, color: "#4f9cff" },
            { icon: Shield, label: "Flagged Suspicious", value: summary.suspicious_accounts_flagged, color: "#ff3a5c" },
            { icon: Network, label: "Fraud Rings", value: summary.fraud_rings_detected, color: "#ff8c00" },
            { icon: Clock, label: "Processing Time", value: `${summary.processing_time_seconds}s`, color: "#22c55e" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4" style={{ color }} />
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {label}
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ─── Interactive Graph ─── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold" style={{ color: "#f0f0f0" }}>Transaction Graph</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(79,156,255,0.12)", color: "#4f9cff" }}>
              Interactive
            </span>
          </div>
          <div style={{ height: "620px" }}>
            <GraphVisualizer
              graphData={graph_data}
              flaggedData={{ suspicious_accounts, fraud_rings }}
            />
          </div>
        </div>

        {/* ─── Fraud Rings Table ─── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold" style={{ color: "#f0f0f0" }}>Detected Fraud Rings</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,58,92,0.12)", color: "#ff3a5c" }}>
              {fraud_rings.length} rings
            </span>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Ring ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Pattern Type</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Members</th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Risk Score</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Member Accounts</th>
                </tr>
              </thead>
              <tbody>
                {fraud_rings.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No fraud rings detected.</td>
                   </tr>
                ) : (
                  fraud_rings.map((ring: any, idx: number) => {
                    const col = RING_PALETTE[idx % RING_PALETTE.length]
                    return (
                      <tr
                        key={ring.ring_id}
                        className="hover:bg-white/[0.02] transition-colors"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      >
                         <td className="px-5 py-3 font-bold text-sm" style={{ color: col }}>
                           {ring.ring_id}
                         </td>
                         <td className="px-5 py-3 text-sm font-medium" style={{ color: "#e0f0ff" }}>
                           {ring.pattern_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                         </td>
                         <td className="px-5 py-3 text-center text-sm" style={{ color: "#e0f0ff" }}>
                           {ring.member_accounts.length}
                         </td>
                         <td className="px-5 py-3 text-right">
                           {riskBadge(ring.risk_level || (ring.risk_score >= 80 ? "CRITICAL" : ring.risk_score >= 60 ? "HIGH" : "MEDIUM"))}
                           <div className="text-xs mt-1" style={{ color: col, fontWeight: "bold" }}>
                             {ring.risk_score.toFixed(1)}
                           </div>
                         </td>
                         <td className="px-5 py-3">
                           {/* Show first 4 accounts, then +N more */}
                           <div className="flex flex-wrap gap-1">
                             {ring.member_accounts.slice(0, 4).map((acc: string) => (
                               <span
                                 key={acc}
                                 className="text-[10px] px-1.5 py-0.5 rounded"
                                 style={{ background: `${col}15`, color: col, border: `1px solid ${col}30` }}
                               >
                                 {acc}
                               </span>
                             ))}
                             {ring.member_accounts.length > 4 && (
                               <span
                                 className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                 style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" }}
                               >
                                 +{ring.member_accounts.length - 4} more
                               </span>
                             )}
                           </div>
                         </td>
                   </tr>
                 )
               })
             )}
           </tbody>
         </table>
       </div>
     </div>

        {/* ─── Suspicious Accounts Table ─── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold" style={{ color: "#f0f0f0" }}>Suspicious Accounts</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,140,0,0.12)", color: "#ff8c00" }}>
              {suspicious_accounts.length} flagged
            </span>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Account", "Score", "Ring", "Patterns"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedAccounts.map((acc: any, i: number) => (
                  <tr
                    key={acc.account_id}
                    style={{
                      borderBottom: i < displayedAccounts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium" style={{ color: "#e0f0ff" }}>{acc.account_id}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${acc.suspicion_score}%`,
                              background: getSuspicionColor(acc.suspicion_score),
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold" style={{
                          color: getSuspicionColor(acc.suspicion_score),
                        }}>
                          {acc.suspicion_score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium" style={{ color: "#4f9cff" }}>{acc.ring_id}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap">
                        {acc.detected_patterns.map((p: string) => patternBadge(p))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Show more / less toggle */}
            {suspicious_accounts.length > 10 && (
              <div className="text-center py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <button
                  onClick={() => setShowAllAccounts((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-white"
                  style={{ color: "#4f9cff" }}
                >
                  {showAllAccounts ? (
                    <>Show Less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Show All {suspicious_accounts.length} Accounts <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<FinancialLoading />}>
      <ResultsContent />
    </Suspense>
  )
}
