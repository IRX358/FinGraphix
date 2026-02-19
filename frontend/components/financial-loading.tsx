"use client"

import { useEffect, useState } from "react"

const LOADING_MESSAGES = [
  "Analyzing financial patterns...",
  "Processing forensic data...",
  "Mapping transaction flows...",
  "Detecting anomaly clusters...",
  "Building correlation graphs...",
  "Scanning data distributions...",
]

/* 
  Graph-node network animation:
  A set of nodes connected by edges that pulse and shift,
  resembling a financial network / forensic graph.
*/
function GraphNodes() {
  // Fixed node positions (percentage-based for responsiveness)
  const nodes = [
    { cx: 20, cy: 30 },
    { cx: 50, cy: 15 },
    { cx: 80, cy: 30 },
    { cx: 35, cy: 55 },
    { cx: 65, cy: 55 },
    { cx: 50, cy: 80 },
    { cx: 10, cy: 65 },
    { cx: 90, cy: 65 },
  ]

  // Edges connecting nodes
  const edges = [
    [0, 1], [1, 2], [0, 3], [2, 4],
    [3, 4], [3, 5], [4, 5], [1, 3],
    [1, 4], [0, 6], [2, 7], [6, 3],
    [7, 4], [5, 6], [5, 7],
  ]

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-64 h-64 md:w-80 md:h-80"
      aria-hidden="true"
    >
      {/* Edges */}
      {edges.map(([from, to], i) => (
        <line
          key={`edge-${i}`}
          x1={nodes[from].cx}
          y1={nodes[from].cy}
          x2={nodes[to].cx}
          y2={nodes[to].cy}
          className="stroke-primary/20"
          strokeWidth="0.3"
        >
          <animate
            attributeName="opacity"
            values="0.15;0.5;0.15"
            dur={`${2 + (i % 4) * 0.7}s`}
            repeatCount="indefinite"
            begin={`${(i * 0.3) % 2}s`}
          />
        </line>
      ))}

      {/* Data-flow pulses along edges */}
      {edges.filter((_, i) => i % 3 === 0).map(([from, to], i) => (
        <circle
          key={`pulse-${i}`}
          r="0.8"
          className="fill-primary"
        >
          <animateMotion
            dur={`${2.5 + i * 0.5}s`}
            repeatCount="indefinite"
            begin={`${i * 0.4}s`}
            path={`M${nodes[from].cx},${nodes[from].cy} L${nodes[to].cx},${nodes[to].cy}`}
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur={`${2.5 + i * 0.5}s`}
            repeatCount="indefinite"
            begin={`${i * 0.4}s`}
          />
        </circle>
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          {/* Outer glow ring */}
          <circle
            cx={node.cx}
            cy={node.cy}
            r="3"
            className="fill-transparent stroke-primary/30"
            strokeWidth="0.3"
          >
            <animate
              attributeName="r"
              values="2.5;3.5;2.5"
              dur={`${3 + (i % 3) * 0.5}s`}
              repeatCount="indefinite"
              begin={`${i * 0.2}s`}
            />
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur={`${3 + (i % 3) * 0.5}s`}
              repeatCount="indefinite"
              begin={`${i * 0.2}s`}
            />
          </circle>
          {/* Inner node */}
          <circle
            cx={node.cx}
            cy={node.cy}
            r="1.5"
            className="fill-primary"
          >
            <animate
              attributeName="opacity"
              values="0.6;1;0.6"
              dur={`${2 + (i % 4) * 0.4}s`}
              repeatCount="indefinite"
              begin={`${i * 0.15}s`}
            />
          </circle>
        </g>
      ))}

      {/* "Financial line flow" – a wavering line across the bottom third */}
      <polyline
        fill="none"
        className="stroke-primary/25"
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="5,88 15,84 25,86 35,80 45,83 55,76 65,79 75,73 85,77 95,70"
      >
        <animate
          attributeName="opacity"
          values="0.2;0.5;0.2"
          dur="4s"
          repeatCount="indefinite"
        />
      </polyline>
      <polyline
        fill="none"
        className="stroke-accent/20"
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="5,92 15,89 25,91 35,85 45,88 55,82 65,84 75,78 85,82 95,75"
      >
        <animate
          attributeName="opacity"
          values="0.15;0.4;0.15"
          dur="5s"
          repeatCount="indefinite"
          begin="0.5s"
        />
      </polyline>
    </svg>
  )
}

export function FinancialLoading() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in duration-700"
      style={{ background: "#050505" }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 45%, #0b1e3b 0%, #121212 40%, #050505 100%)",
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-ambient-glow" style={{ background: "radial-gradient(ellipse, rgba(11,30,59,0.4) 0%, transparent 70%)" }} />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        <GraphNodes />

        <div className="flex flex-col items-center gap-3">
          <p
            key={messageIndex}
            className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>

          {/* Minimal progress dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary"
                style={{
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
