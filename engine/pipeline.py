"""
Pipeline Orchestrator
Orchestrates all stages of the mule detection engine:
  Stage 0: Ingest → Stage 1: Graph Build → Module 1-3: Detection →
  Stage 4: Scoring → Stage 5: Deduplication → Stage 6: Output
"""

import time
import csv
import io

from .config import EngineConfig
from .models import DetectionResult
from .ingest import ingest, ingest_from_graph_json
from .graph_builder import build
from .cycle_detector import detect_cycles
from .smurf_detector import detect_smurfing
from .chain_detector import detect_chains
from .scorer import score_clusters
from .deduplicator import deduplicate
from .output_builder import build_output


class DetectionPipeline:
    def __init__(self, config: EngineConfig = None):
        self.config = config or EngineConfig()

    def run(self, raw_rows: list) -> DetectionResult:
        """
        Main pipeline entry point.
        Input: list of dicts with keys: transaction_id, sender_id, receiver_id, amount, timestamp
        Output: DetectionResult
        """
        processing_start = time.time()

        # Stage 0: Ingest
        edges, rejection_stats = ingest(raw_rows)
        if not edges:
            return self._empty_result(processing_start)

        # Stage 1: Build graph
        adj, radj, node_stats = build(edges)
        all_nodes = list(node_stats.keys())

        # Module 1: Cycle detection
        cycle_clusters, scc_member_nodes = detect_cycles(adj, all_nodes, self.config)

        # Module 2: Smurfing detection
        smurf_clusters = detect_smurfing(adj, radj, node_stats, self.config)

        # Module 3: Shell chain detection
        chain_clusters = detect_chains(adj, node_stats, scc_member_nodes, self.config)

        # Stage 4: Score all non-smurf clusters
        all_structural = cycle_clusters + chain_clusters
        scored_structural = score_clusters(all_structural, self.config)

        # Score smurf clusters separately (they use their own formula)
        active_smurfs = [c for c in smurf_clusters if not c.suppressed
                         and c.rule_score >= self.config.risk_threshold_medium]

        # Stage 5: Deduplicate structural clusters
        deduped = deduplicate(scored_structural, self.config)

        # Stage 6: Build output
        all_clusters = deduped + active_smurfs
        result = build_output(all_clusters, smurf_clusters, node_stats,
                              adj, edges, processing_start, self.config)

        return result

    def run_from_csv(self, csv_content: str) -> DetectionResult:
        """
        Accepts raw CSV string. Parses it and runs the pipeline.
        Expected columns: transaction_id, sender_id, receiver_id, amount, timestamp
        """
        reader = csv.DictReader(io.StringIO(csv_content))
        raw_rows = list(reader)
        return self.run(raw_rows)

    def run_from_graph_json(self, json_data: dict) -> DetectionResult:
        """
        Accepts NetworkX node-link JSON format (dict with 'nodes' and 'links').
        Converts links to row-dicts and runs the pipeline.
        """
        raw_rows = ingest_from_graph_json(json_data)
        return self.run(raw_rows)

    def _empty_result(self, processing_start: float) -> DetectionResult:
        """Returns an empty result when no valid edges are found."""
        return DetectionResult(
            suspicious_accounts=[],
            fraud_rings=[],
            summary={
                "total_accounts_analyzed": 0,
                "suspicious_accounts_flagged": 0,
                "fraud_rings_detected": 0,
                "processing_time_seconds": round(time.time() - processing_start, 3)
            },
            graph_data={"nodes": [], "edges": [], "fraud_edge_pairs": []}
        )
