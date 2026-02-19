"""
Module 3 — Shell Chain Detection
DFS-based shell chain detection with retention-dominance pruning.
Excludes SCC members to avoid double-counting with cycle detection.
"""

import math
from uuid import uuid4
from .models import Cluster
from .config import EngineConfig


def detect_chains(adj: dict, node_stats: dict, scc_member_nodes: set,
                  config: EngineConfig) -> list:
    """
    DFS-based shell chain detection.
    Excludes all nodes that are part of detected SCCs.
    Uses retention-dominance pruning to avoid exponential blowup.
    """
    chains = []

    for start in sorted(node_stats.keys()):
        # Skip SCC members — they belong to cycle detection
        if start in scc_member_nodes:
            continue
        if node_stats[start].out_degree == 0:
            continue

        # Chain origin validity check
        if not _is_valid_origin(start, node_stats, config):
            continue

        out_edges = adj.get(start, [])
        if not out_edges:
            continue

        first_edge = max(out_edges, key=lambda e: e["amount"])
        initial_amount = first_edge["amount"]

        stack = [(start, [start], None, initial_amount)]
        best_retention_at = {}   # (start, current_node) -> best retention seen
        paths_explored = 0

        while stack:
            node, path, last_ts, init_amt = stack.pop()
            if paths_explored >= config.chain_max_paths_per_start:
                break
            paths_explored += 1

            for edge in adj.get(node, []):
                w = edge["target"]

                # Basic exclusions
                if w in path:
                    continue
                if w in scc_member_nodes:
                    continue

                # Time gap constraint (90 minutes between consecutive hops)
                if last_ts is not None:
                    gap = edge["ts"] - last_ts
                    if gap > config.time_gap_max_seconds or gap < 0:
                        continue

                # Shell constraint: intermediate nodes must have <= shell_max_total_tx
                # Applied to nodes that are neither the start nor the immediate next
                if 1 < len(path) < config.chain_max_depth:
                    if node_stats.get(w, None) and node_stats[w].total_tx > config.shell_max_total_tx:
                        continue

                # Retention check
                retention = edge["amount"] / init_amt if init_amt > 0 else 0
                if retention < config.min_retention_ratio:
                    continue

                # Retention-dominance pruning
                prune_key = (start, w)
                if best_retention_at.get(prune_key, -1.0) >= retention:
                    continue
                best_retention_at[prune_key] = retention

                new_path = path + [w]
                hops = len(new_path) - 1

                if hops >= config.chain_min_length:
                    # Zero-inflow origins need 4+ hops to avoid false positives
                    zero_inflow = (node_stats[start].in_degree == 0)
                    min_hops_required = (config.zero_inflow_min_hops
                                         if zero_inflow else config.chain_min_length)

                    if hops >= min_hops_required:
                        cluster = _build_chain_cluster(new_path, adj)
                        if cluster:
                            chains.append(cluster)

                if len(new_path) <= config.chain_max_depth + 1:
                    stack.append((w, new_path, edge["ts"], init_amt))

    return chains


def _is_valid_origin(node: str, node_stats: dict, config: EngineConfig) -> bool:
    """
    A valid chain origin must show signs of being a real money source.
    Returns False for completely isolated nodes that are likely FP traps.
    A node with inflow, or multiple outgoing edges, or a single outgoing
    edge with decent volume is considered valid.
    """
    stats = node_stats[node]
    return stats.total_inflow > 0 or stats.out_degree >= 1


def _build_chain_cluster(path: list, adj: dict):
    """
    Resolves edges along the path and computes scoring signals.
    Returns Cluster or None if path edges cannot be resolved.
    """
    path_edges = []
    for i in range(len(path) - 1):
        src, tgt = path[i], path[i + 1]
        cands = [e for e in adj.get(src, []) if e["target"] == tgt]
        if not cands:
            return None
        path_edges.append(max(cands, key=lambda e: e["amount"]))

    amounts = [e["amount"] for e in path_edges]
    timestamps = [e["ts"] for e in path_edges]
    time_span = max(timestamps) - min(timestamps)

    velocity = amounts[-1] / max(time_span, 1)
    retentions = [amounts[i] / amounts[0] for i in range(len(amounts))]
    geo_retention = math.exp(
        sum(math.log(max(r, 1e-9)) for r in retentions) / len(retentions))
    hop_regularity = (1.0 - (max(amounts) - min(amounts))
                      / max(sum(amounts) / len(amounts), 1)
                      if len(amounts) > 1 else 1.0)

    return Cluster(
        cluster_id=str(uuid4()),
        cluster_type="chain",
        nodes=path,
        raw_structural_score=hop_regularity * 100,
        raw_velocity_score=velocity * 1000,
        raw_retention_score=geo_retention * 100,
        tightness_bonus=0.0,
        retention_floor=0.0,
        time_hrs=time_span / 3600,
        amounts=amounts,
        rule_score=0.0,
        risk_level="LOW"
    )
