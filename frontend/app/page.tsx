"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { UploadDropzone } from "@/components/upload-dropzone"
import { Button } from "@/components/ui/button"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { getBackendUrl } from "@/lib/api"

/* ---- Parallax hook ---- */
function useParallax(speed: number) {
  const [offset, setOffset] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    function tick() {
      setOffset(window.scrollY * speed)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [speed])

  return offset
}

export default function UploadPage() {
  const router = useRouter()
  const [isLoadingSample, setIsLoadingSample] = useState(false)

  const bgOffset = useParallax(0.2)
  const midOffset = useParallax(0.45)

  const hero = useScrollReveal<HTMLDivElement>({ delay: 0 })
  const dropzone = useScrollReveal<HTMLDivElement>({ delay: 120 })
  const cta = useScrollReveal<HTMLDivElement>({ delay: 240 })

  const handleLoadSample = async () => {
    setIsLoadingSample(true)
    try {
      const res = await fetch(getBackendUrl("/api/analyze/sample"), { method: "POST" })
      if (!res.ok) throw new Error("Failed to load sample")
      const data = await res.json()

      router.push(`/dashboard?resultId=${data.result_id}`)
    } catch (error) {
      console.error("Failed to load sample dataset:", error)
    } finally {
      setIsLoadingSample(false)
    }
  }

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: "#050505" }}>

      {/* ---- Background layer (parallax 0.2) ---- */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ transform: `translateY(${bgOffset}px)`, willChange: "transform" }}
      >
        {/* Radial + linear hybrid gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 65% 50% at 50% 38%, #0b1e3b 0%, #121212 40%, #050505 100%)",
          }}
        />
        {/* Secondary dark-blue bloom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 35% 30% at 70% 55%, rgba(11,30,59,0.45) 0%, transparent 100%)",
          }}
        />
        {/* Drifting ambient glow orb */}
        <div className="absolute inset-0 animate-ambient-glow">
          <div
            className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full"
            style={{
              background:
                "radial-gradient(ellipse, rgba(11,30,59,0.55) 0%, rgba(5,5,5,0.15) 55%, transparent 80%)",
            }}
          />
        </div>
        {/* Second drifting glow with offset timing */}
        <div className="absolute inset-0 animate-gradient-drift">
          <div
            className="absolute top-[60%] left-[25%] w-[500px] h-[350px] rounded-full"
            style={{
              background:
                "radial-gradient(ellipse, rgba(11,30,59,0.3) 0%, transparent 70%)",
            }}
          />
        </div>
      </div>

      {/* ---- Noise texture overlay ---- */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* ---- Mid-content layer (parallax 0.45) ---- */}
      <div
        className="relative z-10"
        style={{ transform: `translateY(${midOffset}px)`, willChange: "transform" }}
      >
        <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 pt-28 pb-16">
          <div className="w-full max-w-xl space-y-8">

            {/* Hero text - scroll reveal */}
            <div
              ref={hero.ref}
              className={`scroll-reveal text-center space-y-3 ${hero.isVisible ? "visible" : ""}`}
            >
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm mb-2"
                style={{ background: "rgba(79,156,255,0.12)", color: "#4f9cff" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#4f9cff" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#4f9cff" }} />
                </span>
                Financial Forensics
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-balance" style={{ color: "#f0f0f0" }}>
                Financial Forensic Engine
              </h1>
              <p className="text-lg text-pretty" style={{ color: "rgba(255,255,255,0.55)" }}>
                EXposing hidden money mule networks
              </p>
            </div>

            {/* Dropzone - scroll reveal (staggered) */}
            <div
              ref={dropzone.ref}
              className={`scroll-reveal ${dropzone.isVisible ? "visible" : ""}`}
            >
              <UploadDropzone />
            </div>

            {/* CTA button - scroll reveal (staggered) */}
            <div
              ref={cta.ref}
              className={`scroll-reveal text-center ${cta.isVisible ? "visible" : ""}`}
            >
              <Button
                onClick={handleLoadSample}
                disabled={isLoadingSample}
                className="px-8 py-5 text-base font-medium text-white micro-hover"
                style={{ background: "#22c55e" }}
              >
                {isLoadingSample ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Running Analysis...
                  </>
                ) : (
                  "Run Analysis"
                )}
              </Button>
              <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}
