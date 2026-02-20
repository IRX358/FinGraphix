/**
 * GraphVisualizerDemo.jsx
 * 
 * Example integration showing how to wire GraphVisualizer into your app.
 * In your real app, `graphData` and `flaggedData` come from your FastAPI backend.
 * 
 * Expected API response shapes:
 * 
 *  GET /api/graph  →  graphData
 *  POST /api/analyze (with CSV)  →  flaggedData
 */

import React, { useState } from "react";
import GraphVisualizer from "./GraphVisualizer";

// ─── Sample data (replace with real API calls) ────────────────────────────────
const SAMPLE_GRAPH = {
  nodes: [
    { id: "ACC_001", totalSent: 12000,  totalReceived: 500,   txCount: 8  },
    { id: "ACC_002", totalSent: 8500,   totalReceived: 12000, txCount: 6  },
    { id: "ACC_003", totalSent: 9200,   totalReceived: 8500,  txCount: 5  },
    { id: "ACC_004", totalSent: 200,    totalReceived: 45000, txCount: 22 },
    { id: "ACC_005", totalSent: 45000,  totalReceived: 300,   txCount: 18 },
    { id: "ACC_006", totalSent: 3200,   totalReceived: 3100,  txCount: 3  },
    { id: "ACC_007", totalSent: 3100,   totalReceived: 3200,  txCount: 2  },
    { id: "ACC_008", totalSent: 100,    totalReceived: 100,   txCount: 2  },
    { id: "ACC_009", totalSent: 400,    totalReceived: 400,   txCount: 4  },
    { id: "ACC_010", totalSent: 900,    totalReceived: 900,   txCount: 7  },
  ],
  edges: [
    { source: "ACC_001", target: "ACC_002", amount: 5000, timestamp: "2025-01-10 10:00:00", transaction_id: "TXN_001" },
    { source: "ACC_002", target: "ACC_003", amount: 4800, timestamp: "2025-01-10 11:00:00", transaction_id: "TXN_002" },
    { source: "ACC_003", target: "ACC_001", amount: 4600, timestamp: "2025-01-10 12:00:00", transaction_id: "TXN_003" },
    { source: "ACC_004", target: "ACC_005", amount: 15000,timestamp: "2025-01-11 09:00:00", transaction_id: "TXN_004" },
    { source: "ACC_005", target: "ACC_006", amount: 3200, timestamp: "2025-01-11 10:00:00", transaction_id: "TXN_005" },
    { source: "ACC_006", target: "ACC_007", amount: 3100, timestamp: "2025-01-11 11:00:00", transaction_id: "TXN_006" },
    { source: "ACC_007", target: "ACC_006", amount: 3000, timestamp: "2025-01-11 12:00:00", transaction_id: "TXN_007" },
    { source: "ACC_008", target: "ACC_009", amount: 100,  timestamp: "2025-01-12 08:00:00", transaction_id: "TXN_008" },
    { source: "ACC_009", target: "ACC_010", amount: 200,  timestamp: "2025-01-12 09:00:00", transaction_id: "TXN_009" },
    { source: "ACC_010", target: "ACC_001", amount: 300,  timestamp: "2025-01-12 10:00:00", transaction_id: "TXN_010" },
  ],
};

const SAMPLE_FLAGGED = {
  suspicious_accounts: [
    { account_id: "ACC_001", suspicion_score: 92.5, detected_patterns: ["cycle_length_3", "high_velocity"], ring_id: "RING_001" },
    { account_id: "ACC_002", suspicion_score: 89.0, detected_patterns: ["cycle_length_3"],                  ring_id: "RING_001" },
    { account_id: "ACC_003", suspicion_score: 87.5, detected_patterns: ["cycle_length_3"],                  ring_id: "RING_001" },
    { account_id: "ACC_004", suspicion_score: 78.0, detected_patterns: ["fan_out"],                          ring_id: "RING_002" },
    { account_id: "ACC_005", suspicion_score: 75.0, detected_patterns: ["fan_out"],                          ring_id: "RING_002" },
    { account_id: "ACC_006", suspicion_score: 65.0, detected_patterns: ["shell_network"],                    ring_id: "RING_003" },
    { account_id: "ACC_007", suspicion_score: 63.0, detected_patterns: ["shell_network"],                    ring_id: "RING_003" },
  ],
  fraud_rings: [
    { ring_id: "RING_001", member_accounts: ["ACC_001", "ACC_002", "ACC_003"], pattern_type: "cycle",         risk_score: 95.3 },
    { ring_id: "RING_002", member_accounts: ["ACC_004", "ACC_005"],            pattern_type: "fan_out",        risk_score: 80.1 },
    { ring_id: "RING_003", member_accounts: ["ACC_006", "ACC_007"],            pattern_type: "shell_network",  risk_score: 68.4 },
  ],
  summary: {
    total_accounts_analyzed: 10,
    suspicious_accounts_flagged: 7,
    fraud_rings_detected: 3,
    processing_time_seconds: 0.42,
  },
};

// ─── Demo wrapper ─────────────────────────────────────────────────────────────
export default function GraphVisualizerDemo() {
  const [graphData]   = useState(SAMPLE_GRAPH);
  const [flaggedData] = useState(SAMPLE_FLAGGED);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#080f1a", padding: 20, boxSizing: "border-box" }}>
      <GraphVisualizer graphData={graphData} flaggedData={flaggedData} />
    </div>
  );
}

/*
──────────────────────────────────────────────────────────────────────────────
 REAL INTEGRATION GUIDE
──────────────────────────────────────────────────────────────────────────────

 1. After CSV upload + analysis, your FastAPI backend returns:
 
    graphData = {
      nodes: [ { id, totalSent, totalReceived, txCount }, ... ],
      edges: [ { source, target, amount, timestamp, transaction_id }, ... ]
    }
    
    flaggedData = {
      suspicious_accounts: [ { account_id, suspicion_score, detected_patterns, ring_id }, ... ],
      fraud_rings:          [ { ring_id, member_accounts, pattern_type, risk_score }, ... ],
      summary:              { total_accounts_analyzed, suspicious_accounts_flagged, ... }
    }

 2. Pass them into <GraphVisualizer graphData={graphData} flaggedData={flaggedData} />

 3. The component handles all rendering, interaction, zoom, and selection.

 4. Styling: make the parent container fill the space you want:
      <div style={{ width: "100%", height: "600px" }}>
        <GraphVisualizer ... />
      </div>

 5. Peer dependency:
      npm install d3
──────────────────────────────────────────────────────────────────────────────
*/
