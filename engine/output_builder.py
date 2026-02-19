"""
Stage 6 — Output Builder
Assigns ring IDs, computes per-account suspicion scores,
builds the final DetectionResult including graph_data for the frontend.
"""

import time
from collections import defaultdict
from .models import Cluster, SuspiciousAccount, FraudRing, DetectionResult
from .config import EngineConfig


def build_output(clusters: list, smurf_clusters: list,
                 node_stats: dict, adj: dict, edges: list,
                 processing_start: float,
                 config: EngineConfig) -> DetectionResult:
    """
    Assigns ring IDs, computes per-account suspicion scores,
    builds the final DetectionResult including graph_data for the frontend.
    """
    processing_time = round(time.time() - processing_start, 3)

    # clusters already contains all final clusters (structural + active smurfs)
    # smurf_clusters is only passed for audit/graph_data purposes
    all_clusters = clusters

    node_rings = defaultdict(list)    # account_id -> [ring_id, ...]
    node_best_score = defaultdict(float)

    ring_table = []
    for idx, cluster in enumerate(all_clusters):
        ring_id = f"RING_{idx + 1:03d}"
        for n in cluster.nodes:
            node_rings[n].append(ring_id)
            node_best_score[n] = max(node_best_score[n], cluster.rule_score)

        pattern_type = cluster.cluster_type
        # Normalize smurf types for output
        if "smurf" in pattern_type:
            pattern_type = "smurf"

        ring_table.append(FraudRing(
            ring_id=ring_id,
            member_accounts=sorted(cluster.nodes),
            pattern_type=pattern_type,
            risk_score=cluster.rule_score,
            risk_level=cluster.risk_level
        ))

    # Per-account suspicion score
    suspicious_accounts = []
    for account_id in sorted(node_rings.keys()):
        base = node_best_score[account_id]
        bonus = config.multi_ring_bonus_per_ring * len(node_rings[account_id])
        score = min(round(base + bonus, 2), config.suspicion_score_cap)

        patterns = _derive_patterns(account_id, all_clusters, ring_table)
        primary_ring = node_rings[account_id][0]

        suspicious_accounts.append(SuspiciousAccount(
            account_id=account_id,
            suspicion_score=score,
            detected_patterns=patterns,
            ring_id=primary_ring
        ))

    suspicious_accounts.sort(key=lambda x: -x.suspicion_score)

    summary = {
        "total_accounts_analyzed": len(node_stats),
        "suspicious_accounts_flagged": len(suspicious_accounts),
        "fraud_rings_detected": len(ring_table),
        "processing_time_seconds": processing_time
    }

    graph_data = _build_graph_data(node_stats, adj, edges, all_clusters,
                                   node_rings, node_best_score, smurf_clusters)

    return DetectionResult(
        suspicious_accounts=suspicious_accounts,
        fraud_rings=ring_table,
        summary=summary,
        graph_data=graph_data
    )


def _derive_patterns(account_id: str, clusters: list,
                     ring_table: list) -> list:
    """
    Returns list of pattern strings for the JSON output.
    E.g. ["cycle_length_3", "high_velocity", "smurf_fan_in"]
    """
    patterns = []
    for cluster in clusters:
        if account_id not in cluster.nodes:
            continue
        if cluster.cluster_type == "cycle":
            patterns.append(f"cycle_length_{len(cluster.nodes)}")
            if cluster.time_hrs < 6:
                patterns.append("high_velocity")
            if (cluster.amounts
                    and min(cluster.amounts) / max(cluster.amounts) >= 0.80):
                patterns.append("high_retention")
        elif cluster.cluster_type == "chain":
            patterns.append(f"shell_chain_depth_{len(cluster.nodes) - 1}")
        elif "smurf" in cluster.cluster_type:
            patterns.append(cluster.cluster_type)

    return list(set(patterns))


def _build_graph_data(node_stats: dict, adj: dict, edges: list,
                      clusters: list, node_rings: dict,
                      node_best_score: dict,
                      smurf_clusters: list) -> dict:
    """
    Builds the node/edge data structure consumed by the frontend D3 graph.
    Nodes are annotated with suspicion level for color coding.
    """
    suspicious_nodes = set(node_rings.keys())

    nodes = []
    for n, stats in node_stats.items():
        score = node_best_score.get(n, 0)
        level = ("critical" if score >= 80 else "high" if score >= 60
                 else "medium" if score >= 36 else "normal")
        nodes.append({
            "id": n,
            "label": n,
            "risk_level": level,
            "suspicion_score": round(score, 2),
            "in_degree": stats.in_degree,
            "out_degree": stats.out_degree,
            "total_inflow": round(stats.total_inflow, 2),
            "total_outflow": round(stats.total_outflow, 2),
            # Fields expected by GraphVisualizer.jsx
            "totalSent": round(stats.total_outflow, 2),
            "totalReceived": round(stats.total_inflow, 2),
            "txCount": stats.in_degree + stats.out_degree,
            "rings": node_rings.get(n, [])
        })

    # Build fraud edge signatures from all clusters
    fraud_edge_sigs = set()
    for cluster in clusters:
        for i in range(len(cluster.nodes)):
            if cluster.cluster_type == "cycle":
                src = cluster.nodes[i]
                tgt = cluster.nodes[(i + 1) % len(cluster.nodes)]
            else:
                if i < len(cluster.nodes) - 1:
                    src, tgt = cluster.nodes[i], cluster.nodes[i + 1]
                else:
                    continue
            fraud_edge_sigs.add((src, tgt))

    # Build edge list from adjacency
    edge_list = []
    seen_edges = set()
    for src, out_edges in adj.items():
        for e in out_edges:
            edge_key = (src, e["target"], e["tx_id"])
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)

            is_fraud = (src, e["target"]) in fraud_edge_sigs
            # Find which ring this edge belongs to
            ring_id = ""
            if is_fraud:
                for cluster_idx, cluster in enumerate(clusters):
                    node_set = set(cluster.nodes)
                    if src in node_set and e["target"] in node_set:
                        ring_id = f"RING_{cluster_idx + 1:03d}"
                        break

            from datetime import datetime, timezone
            ts_str = datetime.fromtimestamp(e["ts"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

            edge_list.append({
                "source": src,
                "target": e["target"],
                "amount": e["amount"],
                "timestamp": ts_str,
                "is_fraud_edge": is_fraud,
                "ring_id": ring_id
            })

    return {
        "nodes": nodes,
        "edges": edge_list,
        "fraud_edge_pairs": [list(pair) for pair in fraud_edge_sigs]
    }
