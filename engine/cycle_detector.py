"""
Module 1 — Cycle Detection
Tarjan SCC (iterative) → Bounded Johnson cycle extraction → per-cycle scoring.
"""

from uuid import uuid4
from .models import Cluster
from .config import EngineConfig


def tarjan_scc(adj: dict, all_nodes: list) -> list:
    """
    O(V + E). Returns list of SCCs. Uses iterative implementation
    to avoid Python recursion limit issues.
    """
    index_counter = [0]
    index_map = {}
    lowlink = {}
    on_stack = set()
    stack = []
    sccs = []

    def strongconnect_iterative(start):
        call_stack = [(start, iter(adj.get(start, [])))]
        index_map[start] = lowlink[start] = index_counter[0]
        index_counter[0] += 1
        stack.append(start)
        on_stack.add(start)

        while call_stack:
            v, neighbors = call_stack[-1]
            try:
                edge = next(neighbors)
                w = edge["target"]
                if w not in index_map:
                    index_map[w] = lowlink[w] = index_counter[0]
                    index_counter[0] += 1
                    stack.append(w)
                    on_stack.add(w)
                    call_stack.append((w, iter(adj.get(w, []))))
                elif w in on_stack:
                    lowlink[v] = min(lowlink[v], index_map[w])
            except StopIteration:
                call_stack.pop()
                if call_stack:
                    parent = call_stack[-1][0]
                    lowlink[parent] = min(lowlink[parent], lowlink[v])
                if lowlink[v] == index_map[v]:
                    scc = []
                    while True:
                        w = stack.pop()
                        on_stack.discard(w)
                        scc.append(w)
                        if w == v:
                            break
                    sccs.append(scc)

    for n in all_nodes:
        if n not in index_map:
            strongconnect_iterative(n)

    return sccs


def extract_cycles(scc_nodes: list, adj: dict, config: EngineConfig) -> list:
    """
    Johnson's circuit-finding DFS restricted to SCC nodes.
    Bounded to k_max cycles per SCC.
    Only extracts cycles of length cycle_min_length to cycle_max_length.
    Returns list of node paths (each path is the cycle, closing edge is implied).
    """
    scc_set = set(scc_nodes)
    found = []
    seen_sigs = set()

    for start in scc_nodes:
        stack = [(start, [start], {start})]
        while stack:
            node, path, visited = stack.pop()
            for edge in adj.get(node, []):
                w = edge["target"]
                if w not in scc_set:
                    continue
                if w == start and len(path) >= config.cycle_min_length:
                    sig = frozenset(path)
                    if sig not in seen_sigs and len(path) <= config.cycle_max_length:
                        seen_sigs.add(sig)
                        found.append(path[:])
                        if len(found) >= config.johnson_k_max:
                            return found
                elif w not in visited and len(path) < config.cycle_max_length:
                    stack.append((w, path + [w], visited | {w}))

    return found


def score_cycle(cycle_nodes: list, scc: list, adj: dict,
                config: EngineConfig) -> dict:
    """
    Computes raw_structural, raw_velocity, raw_retention, tightness_bonus,
    retention_floor for a single cycle.
    """
    # Resolve edges along the cycle
    edges_in = []
    for i in range(len(cycle_nodes)):
        src = cycle_nodes[i]
        tgt = cycle_nodes[(i + 1) % len(cycle_nodes)]
        cands = [e for e in adj.get(src, []) if e["target"] == tgt]
        if not cands:
            return None  # edge missing, skip
        edges_in.append(cands[0])

    amounts = [e["amount"] for e in edges_in]
    timestamps = sorted(e["ts"] for e in edges_in)
    time_hrs = (timestamps[-1] - timestamps[0]) / 3600
    retention = min(amounts) / max(amounts)

    # SCC density as structural signal
    scc_set = set(scc)
    n = len(scc)
    internal = sum(1 for s in scc for e in adj.get(s, []) if e["target"] in scc_set)
    density = internal / (n * (n - 1)) if n > 1 else 0

    abs_vel = (min(amounts) * len(cycle_nodes)) / max(time_hrs, 0.1)
    tightness = max(0, (config.tightness_hours_cutoff - time_hrs)
                    / config.tightness_hours_cutoff) * config.tightness_bonus_max

    retention_floor = (config.risk_threshold_high
                       if retention >= config.retention_floor_high
                       else (50.0 if retention >= config.retention_floor_low else 0.0))

    return {
        "raw_structural": density * 100,
        "raw_velocity": abs_vel,
        "raw_retention": retention * 100,
        "tightness_bonus": tightness,
        "retention_floor": retention_floor,
        "time_hrs": time_hrs,
        "amounts": amounts
    }


def detect_cycles(adj: dict, all_nodes: list,
                  config: EngineConfig) -> tuple:
    """
    Returns (cycle_clusters, scc_member_nodes)
    scc_member_nodes is used by chain detector to exclude SCC members.
    """
    sccs = tarjan_scc(adj, all_nodes)
    cycle_sccs = [s for s in sccs if len(s) >= config.scc_min_size]
    scc_member_nodes = set(n for scc in cycle_sccs for n in scc)

    clusters = []
    for scc in cycle_sccs:
        cycles = extract_cycles(scc, adj, config)
        for cycle_nodes in cycles:
            scored = score_cycle(cycle_nodes, scc, adj, config)
            if scored is None:
                continue
            clusters.append(Cluster(
                cluster_id=str(uuid4()),
                cluster_type="cycle",
                nodes=cycle_nodes,
                raw_structural_score=scored["raw_structural"],
                raw_velocity_score=scored["raw_velocity"],
                raw_retention_score=scored["raw_retention"],
                tightness_bonus=scored["tightness_bonus"],
                retention_floor=scored["retention_floor"],
                time_hrs=scored["time_hrs"],
                amounts=scored["amounts"],
                rule_score=0.0,
                risk_level="LOW"
            ))

    return clusters, scc_member_nodes
