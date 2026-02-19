"use client"

import { useEffect, useRef, useState } from "react"
import embed from "vega-embed"

interface VegaChartProps {
  spec: object
  className?: string
}

export function VegaChart({ spec, className }: VegaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Observe container width changes
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(containerRef.current)
    // Set initial width
    setContainerWidth(containerRef.current.clientWidth)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!containerRef.current || containerWidth === 0) return

    const embedChart = async () => {
      try {
        // Normalise schema to v6 and adapt container width
        const vegaSpec = spec as Record<string, unknown>
        const schema = typeof vegaSpec.$schema === "string"
          ? vegaSpec.$schema.replace(/\/vega-lite\/v\d+\.json/, "/vega-lite/v6.json")
          : "https://vega.github.io/schema/vega-lite/v6.json"
        const modifiedSpec = {
          ...vegaSpec,
          $schema: schema,
          width: vegaSpec.width === "container" ? Math.max(containerWidth - 60, 200) : vegaSpec.width,
          autosize: { type: "fit", contains: "padding" },
        }

        await embed(containerRef.current!, modifiedSpec as Parameters<typeof embed>[1], {
          actions: false,
          renderer: "svg",
          config: {
            background: "transparent",
            axis: {
              labelColor: "#a1a1aa",
              titleColor: "#d4d4d8",
              gridColor: "#3f3f46",
              domainColor: "#52525b",
              tickColor: "#52525b",
            },
            legend: {
              labelColor: "#a1a1aa",
              titleColor: "#d4d4d8",
            },
            title: {
              color: "#d4d4d8",
            },
            view: {
              stroke: "transparent",
            },
            range: {
              category: ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#2dd4bf"],
            },
          },
        })
      } catch (error) {
        console.error("Failed to render chart:", error)
      }
    }

    embedChart()

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }
    }
  }, [spec, containerWidth])

  return <div ref={containerRef} className={className} style={{ width: "100%" }} />
}
