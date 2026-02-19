"""
Run Engine — Standalone script to process transactions_graph.json
and produce detection_output.json with the exact required format.
"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from engine.pipeline import DetectionPipeline


def main():
    # Determine input file
    graph_json_path = Path(__file__).parent / "transactions_graph.json"
    csv_path = Path(__file__).parent / "data" / "transactions.csv"
    output_path = Path(__file__).parent / "detection_output.json"

    pipeline = DetectionPipeline()

    if graph_json_path.exists():
        print(f"Loading graph from: {graph_json_path}")
        with open(graph_json_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        print(f"  Nodes: {len(graph_data.get('nodes', []))}")
        print(f"  Links: {len(graph_data.get('links', []))}")

        result = pipeline.run_from_graph_json(graph_data)
    elif csv_path.exists():
        print(f"Loading CSV from: {csv_path}")
        with open(csv_path, "r", encoding="utf-8") as f:
            csv_content = f.read()
        result = pipeline.run_from_csv(csv_content)
    else:
        print("ERROR: No input file found (transactions_graph.json or data/transactions.csv)")
        sys.exit(1)

    # Build output JSON in the exact required format
    output = {
        "suspicious_accounts": [
            {
                "account_id": a.account_id,
                "suspicion_score": a.suspicion_score,
                "detected_patterns": a.detected_patterns,
                "ring_id": a.ring_id
            }
            for a in result.suspicious_accounts
        ],
        "fraud_rings": [
            {
                "ring_id": r.ring_id,
                "member_accounts": r.member_accounts,
                "pattern_type": r.pattern_type,
                "risk_score": r.risk_score
            }
            for r in result.fraud_rings
        ],
        "summary": result.summary
    }

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    # Print summary
    print(f"\n{'='*60}")
    print(f"  MULE DETECTION ENGINE — RESULTS")
    print(f"{'='*60}")
    print(f"  Total accounts analyzed:    {result.summary['total_accounts_analyzed']}")
    print(f"  Suspicious accounts flagged: {result.summary['suspicious_accounts_flagged']}")
    print(f"  Fraud rings detected:        {result.summary['fraud_rings_detected']}")
    print(f"  Processing time:             {result.summary['processing_time_seconds']}s")
    print(f"{'='*60}")

    if result.fraud_rings:
        print(f"\n  Detected Fraud Rings:")
        for ring in result.fraud_rings:
            print(f"    {ring.ring_id}: {ring.pattern_type} | "
                  f"risk={ring.risk_score} | "
                  f"members={ring.member_accounts}")

    if result.suspicious_accounts:
        print(f"\n  Top Suspicious Accounts:")
        for acc in result.suspicious_accounts[:10]:
            print(f"    {acc.account_id}: score={acc.suspicion_score} | "
                  f"patterns={acc.detected_patterns} | ring={acc.ring_id}")

    print(f"\n  Output saved to: {output_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
