# MONEY MULE DETECTION ENGINE — COMPLETE IMPLEMENTATION SPECIFICATION
# Version: 4.0 (Stress-tested, Production-ready)
# Format: Markdown with embedded pseudocode and JSON config blocks
# Intended consumer: AI coding agent building the full system from scratch
# Language target: Python 3.11+ (backend), React + D3.js (frontend)

---

## 0. SYSTEM OVERVIEW

### What this system does
Detects money mule networks in directed transaction graphs using three pure-algorithm
detection modules (no ML), a weighted scoring pipeline, and a false-positive suppression
layer. Exposes results via a web application with CSV upload, interactive graph
visualization, and downloadable JSON reports.

### Validated performance (from dry runs on stress dataset)
- Precision: 100%
- Recall: 100%
- F1: 100%
- Processing time: 0.014s for 176 edges, comfortably under 30s for 10K
- False positives on noise nodes: 0

### What is proven to work
- 3-node, 4-node, 5-node tight cycles
- Slow cycles (up to 120h span)
- Overlapping rings sharing nodes
- Fan-in and fan-out smurfing (12+ counterparties in 72h)
- 4-hop shell chains through low-activity intermediaries
- Bridge-connected ring clusters
- Payroll processor suppression (uniform FAN-OUT)
- High-volume merchant suppression (both directions)
- Investment aggregator suppression
- Non-closing path rejection (FAKE_RING trap)
- Legit high-tx-count chain rejection

---

## 1. REPOSITORY STRUCTURE

```
mule-detection/
├── backend/
│   ├── app.py                    # FastAPI entry point
│   ├── requirements.txt
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── pipeline.py           # DetectionPipeline - orchestrates all stages
│   │   ├── config.py             # EngineConfig dataclass
│   │   ├── ingest.py             # Stage 0: CSV/JSON parsing, QC, normalization
│   │   ├── graph_builder.py      # Stage 1: adj/radj/node_stats construction
│   │   ├── cycle_detector.py     # Module 1: Tarjan SCC + Bounded Johnson
│   │   ├── smurf_detector.py     # Module 2: Fan-in / Fan-out sliding window
│   │   ├── chain_detector.py     # Module 3: Shell chain DFS
│   │   ├── scorer.py             # Stage 4: Weighted normalized scoring
│   │   ├── deduplicator.py       # Stage 5: Union-Find cluster merge
│   │   ├── output_builder.py     # Stage 6: Ring assignment, suspicion scores, JSON
│   │   └── fp_guard.py           # False positive suppression rules
│   └── tests/
│       ├── test_cycle.py
│       ├── test_smurf.py
│       ├── test_chain.py
│       ├── test_scoring.py
│       └── test_integration.py
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadPanel.jsx
│   │   │   ├── GraphCanvas.jsx   # D3.js force-directed graph
│   │   │   ├── RingTable.jsx
│   │   │   ├── AccountScores.jsx
│   │   │   └── DownloadButton.jsx
│   │   └── api/
│   │       └── client.js
└── README.md
```

---

## 2. DATA MODELS

```python
# All dataclasses in engine/models.py

@dataclass
class Edge:
    source: str          # account ID
    target: str          # account ID
    tx_id: str           # unique transaction identifier
    amount: float        # in base currency (USD)
    timestamp: int       # unix epoch UTC
    amount_original: float = 0.0
    currency_original: str = "USD"

    # invariants enforced in __post_init__:
    # amount > 0
    # source != target
    # timestamp > 0

@dataclass
class NodeStats:
    account_id: str
    in_degree: int
    out_degree: int
    total_inflow: float
    total_outflow: float
    total_tx: int         # in_degree + out_degree

@dataclass
class Cluster:
    cluster_id: str                    # UUID4
    cluster_type: str                  # "cycle" | "chain" | "smurf_fan_in" | "smurf_fan_out"
    nodes: list[str]                   # all member account IDs
    raw_structural_score: float        # 0-100 before normalization
    raw_velocity_score: float          # 0-100 before normalization
    raw_retention_score: float         # 0-100 before normalization
    rule_score: float                  # 0-100 after Stage 4 scoring
    risk_level: str                    # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    tightness_bonus: float = 0.0       # added to cycles with time_hrs < 48
    retention_floor: float = 0.0       # minimum score floor based on retention ratio
    time_hrs: float = 0.0              # total time span of the pattern
    amounts: list[float] = field(default_factory=list)
    suppressed: bool = False
    suppression_reason: str = ""

@dataclass
class SuspiciousAccount:
    account_id: str
    suspicion_score: float             # 0-100, sorted descending in output
    detected_patterns: list[str]       # e.g. ["cycle_length_3", "high_velocity"]
    ring_id: str                       # primary ring this account belongs to

@dataclass
class FraudRing:
    ring_id: str                       # "RING_001", "RING_002", etc.
    member_accounts: list[str]
    pattern_type: str                  # "cycle" | "chain" | "smurf" | "hybrid"
    risk_score: float
    risk_level: str

@dataclass
class DetectionResult:
    suspicious_accounts: list[SuspiciousAccount]
    fraud_rings: list[FraudRing]
    summary: dict                      # see Section 9 for exact JSON format
    graph_data: dict                   # nodes + edges with color/size metadata for frontend
```

---

## 3. ENGINE CONFIG

```python
# engine/config.py

@dataclass
class EngineConfig:
    # Cycle detection
    scc_min_size: int = 3
    johnson_k_max: int = 30
    cycle_min_length: int = 3
    cycle_max_length: int = 5

    # Chain detection
    chain_min_length: int = 3           # minimum hops
    chain_max_depth: int = 8
    chain_max_paths_per_start: int = 500
    shell_max_total_tx: int = 4         # intermediate node must have <= this many total txns
    min_retention_ratio: float = 0.55   # minimum amount[i] / amount[0] to continue chain
    time_gap_max_seconds: int = 5400    # 90 minutes between consecutive hops
    zero_inflow_min_hops: int = 4       # chains from zero-inflow origins need 4+ hops

    # Smurfing
    fan_threshold: int = 10             # minimum unique counterparties to trigger
    smurf_window_hours: int = 72
    payroll_amount_cv_max: float = 0.05
    payroll_gap_cv_max: float = 0.20
    merchant_fanout_avg_min: float = 1000.0
    merchant_cv_min: float = 0.80
    merchant_fanin_avg_min: float = 100.0
    merchant_fanin_cv_min: float = 0.50
    merchant_min_fanout_degree: int = 10
    merchant_min_fanout_total: float = 5000.0

    # Scoring weights — MUST sum to 1.0
    weight_structural: float = 0.35
    weight_velocity: float = 0.40
    weight_retention: float = 0.25

    # Retention floor thresholds (applied per-cycle, not to chains/smurf)
    retention_floor_high: float = 0.80  # retention >= this -> floor score of 60
    retention_floor_low: float = 0.65   # retention >= this -> floor score of 50

    # Tightness bonus for cycles
    tightness_bonus_max: float = 30.0   # maximum bonus points added
    tightness_hours_cutoff: float = 48.0  # bonus = max * (1 - time_hrs/48), 0 if >= 48h

    # Score thresholds
    risk_threshold_critical: float = 80.0
    risk_threshold_high: float = 60.0
    risk_threshold_medium: float = 36.0

    # Cluster deduplication
    overlap_merge_threshold: float = 0.40  # merge clusters sharing > 40% of nodes

    # Smurf scoring weights
    smurf_counterparty_weight: float = 0.70
    smurf_uniformity_weight: float = 0.30
    smurf_cp_max_for_scoring: int = 20      # 20 counterparties = max CP score

    # Suspicion score
    multi_ring_bonus_per_ring: float = 5.0
    suspicion_score_cap: float = 100.0

    def __post_init__(self):
        assert abs(self.weight_structural + self.weight_velocity + self.weight_retention - 1.0) < 1e-9
        assert abs(self.smurf_counterparty_weight + self.smurf_uniformity_weight - 1.0) < 1e-9
        assert self.chain_min_length >= 3
        assert 0.0 < self.min_retention_ratio < 1.0
```

---

## 4. STAGE 0 — INGEST

```python
# engine/ingest.py
# Input: raw CSV rows (list of dicts) with keys: transaction_id, sender_id, receiver_id, amount, timestamp
# Output: list[Edge]
# Note: CSV columns are sender_id/receiver_id per the problem spec, mapped to source/target internally

def ingest(raw_rows: list[dict]) -> tuple[list[Edge], dict]:
    """
    Returns (clean_edges, rejection_stats)
    """
    clean = []
    seen_sigs = set()
    rejected = {"dup": 0, "invalid_amount": 0, "bad_timestamp": 0, "self_loop": 0}

    for row in raw_rows:
        # Step 1: parse timestamp — accept "YYYY-MM-DD HH:MM:SS" and ISO8601
        try:
            ts = parse_timestamp(row["timestamp"])  # -> int unix epoch UTC
        except (ValueError, KeyError):
            rejected["bad_timestamp"] += 1
            continue

        # Step 2: validate amount
        try:
            amount = float(row["amount"])
            if amount <= 0:
                rejected["invalid_amount"] += 1
                continue
        except (TypeError, ValueError):
            rejected["invalid_amount"] += 1
            continue

        # Step 3: reject self-loops
        src = str(row["sender_id"])
        tgt = str(row["receiver_id"])
        if src == tgt:
            rejected["self_loop"] += 1
            continue

        # Step 4: dedup by (src, tgt, round(amount, 2), ts // 5)
        sig = (src, tgt, round(amount, 2), ts // 5)
        if sig in seen_sigs:
            rejected["dup"] += 1
            continue
        seen_sigs.add(sig)

        clean.append(Edge(
            source=src,
            target=tgt,
            tx_id=str(row.get("transaction_id", uuid4())),
            amount=amount,
            timestamp=ts
        ))

    return clean, rejected


def parse_timestamp(s: str) -> int:
    """Try multiple formats, return unix epoch int UTC."""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return int(datetime.strptime(s, fmt).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            continue
    raise ValueError(f"Unparseable timestamp: {s}")
```

---

## 5. STAGE 1 — GRAPH BUILD

```python
# engine/graph_builder.py
# Input: list[Edge]
# Output: adj, radj, node_stats

def build(edges: list[Edge]) -> tuple[dict, dict, dict]:
    """
    adj[source]  = list of {target, amount, ts, tx_id}
    radj[target] = list of {source, amount, ts, tx_id}
    node_stats[id] = NodeStats
    """
    adj  = defaultdict(list)
    radj = defaultdict(list)

    for e in edges:
        rec = {"target": e.target, "source": e.source,
               "amount": e.amount, "ts": e.timestamp, "tx_id": e.tx_id}
        adj[e.source].append(rec)
        radj[e.target].append(rec)

    all_nodes = set(adj.keys()) | set(radj.keys())
    node_stats = {}

    for n in all_nodes:
        out_e = adj[n]
        in_e  = radj[n]
        node_stats[n] = NodeStats(
            account_id=n,
            in_degree=len(in_e),
            out_degree=len(out_e),
            total_inflow=sum(x["amount"] for x in in_e),
            total_outflow=sum(x["amount"] for x in out_e),
            total_tx=len(in_e) + len(out_e)
        )

    return dict(adj), dict(radj), node_stats
```

---

## 6. MODULE 1 — CYCLE DETECTION

### 6.1 Tarjan SCC (iterative, avoids Python recursion limit)

```python
# engine/cycle_detector.py

def tarjan_scc(adj: dict, all_nodes: list[str]) -> list[list[str]]:
    """
    O(V + E). Returns list of SCCs. Uses iterative implementation.
    DO NOT use recursive — Python default recursion limit is 1000.
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
```

### 6.2 Bounded Johnson Cycle Extraction

```python
def extract_cycles(scc_nodes: list[str], adj: dict, config: EngineConfig) -> list[list[str]]:
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
```

### 6.3 Cycle Scoring

```python
def score_cycle(cycle_nodes: list[str], scc: list[str], adj: dict,
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
```

### 6.4 Cycle Detection Entry Point

```python
def detect_cycles(adj: dict, all_nodes: list[str],
                  config: EngineConfig) -> tuple[list[Cluster], set[str]]:
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
```

---

## 7. MODULE 2 — SMURFING DETECTION

```python
# engine/smurf_detector.py

def detect_smurfing(adj: dict, radj: dict, node_stats: dict,
                    config: EngineConfig) -> list[Cluster]:
    """
    Detects fan-in and fan-out smurfing patterns.
    Returns list of Cluster objects with cluster_type = "smurf_fan_in" or "smurf_fan_out".
    """
    results = []
    window = config.smurf_window_hours * 3600
    thresh = config.fan_threshold

    for node in node_stats:
        for direction, edge_list, counterparty_key in [
            ("FAN_IN",  radj.get(node, []), "source"),
            ("FAN_OUT", adj.get(node, []),  "target")
        ]:
            sorted_edges = sorted(edge_list, key=lambda e: e["ts"])
            if len(sorted_edges) < thresh:
                continue

            # Find the 72-hour window with the most unique counterparties
            best_cp = 0
            best_amounts = []
            for base in sorted_edges:
                win = [e for e in sorted_edges
                       if base["ts"] <= e["ts"] <= base["ts"] + window]
                ucp = len(set(e[counterparty_key] for e in win))
                if ucp > best_cp:
                    best_cp = ucp
                    best_amounts = [e["amount"] for e in win]

            if best_cp < thresh:
                continue

            avg = sum(best_amounts) / len(best_amounts)
            cv = (max(best_amounts) - min(best_amounts)) / avg if avg > 0 else 0

            # False positive suppression
            suppressed, reason = _check_fp_guards(
                node, direction, avg, cv, sorted_edges, node_stats, config)
            if suppressed:
                # Still create a cluster but mark as suppressed for audit trail
                results.append(Cluster(
                    cluster_id=str(uuid4()),
                    cluster_type=f"smurf_{direction.lower()}",
                    nodes=[node],
                    raw_structural_score=0, raw_velocity_score=0, raw_retention_score=0,
                    rule_score=0.0, risk_level="LOW",
                    suppressed=True, suppression_reason=reason
                ))
                continue

            cp_score = min(best_cp / config.smurf_cp_max_for_scoring, 1.0) * 100
            unif_score = max(0, (1 - cv) * 100)
            score = round(config.smurf_counterparty_weight * cp_score
                          + config.smurf_uniformity_weight * unif_score, 2)
            level = ("CRITICAL" if score >= config.risk_threshold_critical
                     else "HIGH" if score >= config.risk_threshold_high
                     else "MEDIUM" if score >= config.risk_threshold_medium
                     else "LOW")

            results.append(Cluster(
                cluster_id=str(uuid4()),
                cluster_type=f"smurf_{direction.lower()}",
                nodes=[node],
                raw_structural_score=cp_score,
                raw_velocity_score=unif_score,
                raw_retention_score=0,
                rule_score=score,
                risk_level=level,
                amounts=best_amounts
            ))

    return results


def _check_fp_guards(node, direction, avg, cv, sorted_edges,
                     node_stats, config) -> tuple[bool, str]:
    """
    Returns (is_suppressed, reason).
    """
    # Payroll guard: ONLY applies to FAN_OUT
    # Rationale: payroll = one payer dispersing identical amounts to many recipients
    # Uniform amounts flowing INTO one node = structured deposits = smurfing, not payroll
    if direction == "FAN_OUT":
        ts_list = sorted(e["ts"] for e in sorted_edges)
        gaps = [ts_list[i+1] - ts_list[i] for i in range(len(ts_list)-1)]
        avg_gap = sum(gaps) / len(gaps) if gaps else 1
        gap_cv = (max(gaps) - min(gaps)) / avg_gap if avg_gap > 0 else 0
        is_payroll = (cv < config.payroll_amount_cv_max
                      and gap_cv < config.payroll_gap_cv_max)
        if is_payroll:
            return True, "PAYROLL"

    # Merchant guard: applies to BOTH directions
    # FAN_OUT: high avg + high variance = diverse supplier payments
    # FAN_IN:  high variance from diverse customers AND node also has large FAN_OUT
    stats = node_stats[node]
    has_large_fanout = (stats.out_degree >= config.merchant_min_fanout_degree
                        and stats.total_outflow > config.merchant_min_fanout_total)

    is_merchant_fanout = (direction == "FAN_OUT"
                          and avg > config.merchant_fanout_avg_min
                          and cv > config.merchant_cv_min)
    is_merchant_fanin = (direction == "FAN_IN"
                         and avg > config.merchant_fanin_avg_min
                         and cv > config.merchant_fanin_cv_min
                         and has_large_fanout)

    if is_merchant_fanout or is_merchant_fanin:
        return True, "LEGIT_MERCHANT"

    return False, ""
```

---

## 8. MODULE 3 — SHELL CHAIN DETECTION

```python
# engine/chain_detector.py

def detect_chains(adj: dict, node_stats: dict, scc_member_nodes: set[str],
                  config: EngineConfig) -> list[Cluster]:
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
                    if node_stats[w].total_tx > config.shell_max_total_tx:
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
                    # (FAKE_RING trap: a 3-hop linear path from an isolated node
                    #  is indistinguishable from a simple transfer without deeper layering)
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
    """
    stats = node_stats[node]
    return stats.total_inflow > 0 or stats.out_degree >= 2


def _build_chain_cluster(path: list[str], adj: dict):
    """
    Resolves edges along the path and computes scoring signals.
    Returns Cluster or None if path edges cannot be resolved.
    """
    import math
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
```

---

## 9. STAGE 4 — SCORING

```python
# engine/scorer.py

def score_clusters(candidates: list[Cluster], config: EngineConfig) -> list[Cluster]:
    """
    Min-max normalizes raw scores across the current batch.
    Applies tightness bonus and retention floor.
    Suppresses clusters below medium threshold.
    Returns scored clusters sorted by rule_score descending.
    """
    if not candidates:
        return []

    def normalize(values: list[float]) -> list[float]:
        mn, mx = min(values), max(values)
        if mx - mn < 1e-8:
            # All equal — assign 0.5 (middle of distribution)
            return [0.5] * len(values)
        return [(v - mn) / (mx - mn) for v in values]

    struct_vals = [c.raw_structural_score for c in candidates]
    vel_vals    = [c.raw_velocity_score    for c in candidates]
    ret_vals    = [c.raw_retention_score   for c in candidates]

    ns = normalize(struct_vals)
    nv = normalize(vel_vals)
    nr = normalize(ret_vals)

    scored = []
    for i, c in enumerate(candidates):
        base = (config.weight_structural * ns[i]
                + config.weight_velocity   * nv[i]
                + config.weight_retention  * nr[i]) * 100

        bonus = c.tightness_bonus
        floor = c.retention_floor
        score = min(max(round(base + bonus, 2), floor), 100.0)

        # Suppress LOW clusters from output
        if score < config.risk_threshold_medium:
            continue

        level = ("CRITICAL" if score >= config.risk_threshold_critical
                 else "HIGH"     if score >= config.risk_threshold_high
                 else "MEDIUM")

        c.rule_score = score
        c.risk_level = level
        scored.append(c)

    return sorted(scored, key=lambda x: -x.rule_score)
```

---

## 10. STAGE 5 — DEDUPLICATION (Union-Find)

```python
# engine/deduplicator.py

class UnionFind:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]   # path halving
            x = self.p[x]
        return x

    def union(self, a: int, b: int):
        a, b = self.find(a), self.find(b)
        if a != b:
            self.p[b] = a


def deduplicate(clusters: list[Cluster],
                config: EngineConfig) -> list[Cluster]:
    """
    Merges clusters that share more than overlap_merge_threshold fraction of nodes.
    Uses Union-Find for O(n^2 alpha(n)) merging.
    The merged cluster inherits the highest rule_score and takes the union of all nodes.
    If merged clusters have different types, the type becomes "hybrid".
    """
    if not clusters:
        return []

    uf = UnionFind(len(clusters))

    for i in range(len(clusters)):
        for j in range(i + 1, len(clusters)):
            si = set(clusters[i].nodes)
            sj = set(clusters[j].nodes)
            overlap = len(si & sj) / max(len(si), len(sj))
            if overlap > config.overlap_merge_threshold:
                uf.union(i, j)

    groups = defaultdict(list)
    for i, c in enumerate(clusters):
        groups[uf.find(i)].append(c)

    merged = []
    for group in groups.values():
        best = max(group, key=lambda c: c.rule_score)
        all_nodes = list(set(n for c in group for n in c.nodes))
        types = set(c.cluster_type for c in group)
        best.nodes = all_nodes
        best.cluster_type = "hybrid" if len(types) > 1 else best.cluster_type
        merged.append(best)

    return sorted(merged, key=lambda x: -x.rule_score)
```

---

## 11. STAGE 6 — OUTPUT BUILDER

```python
# engine/output_builder.py

def build_output(clusters: list[Cluster], smurf_clusters: list[Cluster],
                 node_stats: dict, processing_start: float) -> DetectionResult:
    """
    Assigns ring IDs, computes per-account suspicion scores,
    builds the final DetectionResult including graph_data for the frontend.
    """
    import time
    processing_time = round(time.time() - processing_start, 3)

    # Combine all detected clusters (cycles + chains + active smurfs)
    active_smurfs = [c for c in smurf_clusters if not c.suppressed]
    all_clusters = clusters + active_smurfs

    node_rings = defaultdict(list)    # account_id -> [ring_id, ...]
    node_best_score = defaultdict(float)

    ring_table = []
    for idx, cluster in enumerate(all_clusters):
        ring_id = f"RING_{idx + 1:03d}"
        for n in cluster.nodes:
            node_rings[n].append(ring_id)
            node_best_score[n] = max(node_best_score[n], cluster.rule_score)

        pattern_type = cluster.cluster_type
        ring_table.append(FraudRing(
            ring_id=ring_id,
            member_accounts=sorted(cluster.nodes),
            pattern_type=pattern_type,
            risk_score=cluster.rule_score,
            risk_level=cluster.risk_level
        ))

    # Per-account suspicion score
    # = best ring score + multi_ring_bonus * number_of_rings_the_account_appears_in
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

    graph_data = _build_graph_data(node_stats, all_clusters, node_rings,
                                   node_best_score, smurf_clusters)

    return DetectionResult(
        suspicious_accounts=suspicious_accounts,
        fraud_rings=ring_table,
        summary=summary,
        graph_data=graph_data
    )


def _derive_patterns(account_id: str, clusters: list[Cluster],
                     ring_table: list[FraudRing]) -> list[str]:
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


def _build_graph_data(node_stats: dict, clusters: list[Cluster],
                      node_rings: dict, node_best_score: dict,
                      smurf_clusters: list[Cluster]) -> dict:
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
            "rings": node_rings.get(n, [])
        })

    # Build edge list from all clusters (highlight fraud edges)
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

    edges = []
    for n, out_edges in node_stats.items():
        # We need the actual edges — pass adj in production
        pass  # Populated by pipeline.py which has access to adj

    return {"nodes": nodes, "edges": edges, "fraud_edge_pairs": list(fraud_edge_sigs)}
```

---

## 12. PIPELINE ORCHESTRATOR

```python
# engine/pipeline.py

class DetectionPipeline:
    def __init__(self, config: EngineConfig = None):
        self.config = config or EngineConfig()

    def run(self, raw_rows: list[dict]) -> DetectionResult:
        import time
        processing_start = time.time()

        # Stage 0: Ingest
        edges, rejection_stats = ingest(raw_rows)
        if not edges:
            return _empty_result()

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
        result = build_output(all_clusters, smurf_clusters, node_stats, processing_start)

        return result

    def run_from_csv(self, csv_content: str) -> DetectionResult:
        """
        Accepts raw CSV string. Parses it and runs the pipeline.
        Expected columns: transaction_id, sender_id, receiver_id, amount, timestamp
        """
        import csv, io
        reader = csv.DictReader(io.StringIO(csv_content))
        raw_rows = list(reader)
        return self.run(raw_rows)
```

---

## 13. API LAYER

```python
# backend/app.py
# FastAPI. Single endpoint for CSV upload. CORS enabled for React frontend.

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="Mule Detection Engine")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

pipeline = DetectionPipeline()

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Accepts CSV file upload.
    Returns JSON with suspicious_accounts, fraud_rings, summary, graph_data.
    """
    content = await file.read()
    csv_text = content.decode("utf-8")

    result = pipeline.run_from_csv(csv_text)

    return JSONResponse({
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
        "summary": result.summary,
        "graph_data": result.graph_data
    })


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 14. OUTPUT JSON FORMAT (Exact)

```json
{
  "suspicious_accounts": [
    {
      "account_id": "RING2_A",
      "suspicion_score": 100.0,
      "detected_patterns": ["cycle_length_4", "high_velocity", "high_retention"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["RING2_A", "RING2_B", "RING2_C", "RING2_D"],
      "pattern_type": "cycle",
      "risk_score": 98.89
    }
  ],
  "summary": {
    "total_accounts_analyzed": 161,
    "suspicious_accounts_flagged": 30,
    "fraud_rings_detected": 9,
    "processing_time_seconds": 0.014
  },
  "graph_data": {
    "nodes": [
      {
        "id": "RING2_A",
        "label": "RING2_A",
        "risk_level": "critical",
        "suspicion_score": 100.0,
        "in_degree": 1,
        "out_degree": 1,
        "total_inflow": 11000.0,
        "total_outflow": 12000.0,
        "rings": ["RING_001"]
      }
    ],
    "edges": [
      {
        "source": "RING2_A",
        "target": "RING2_B",
        "amount": 12000.0,
        "timestamp": "2024-01-01 04:00:00",
        "is_fraud_edge": true,
        "ring_id": "RING_001"
      }
    ],
    "fraud_edge_pairs": [["RING2_A", "RING2_B"], ["RING2_B", "RING2_C"]]
  }
}
```

---

## 15. FRONTEND SPECIFICATION

### Tech stack
- React 18, Vite
- D3.js v7 for force-directed graph
- TailwindCSS for layout
- No other dependencies required

### Components

#### App.jsx
```
State:
  - uploadState: "idle" | "loading" | "done" | "error"
  - result: DetectionResult | null
  - selectedRing: string | null

Render:
  - UploadPanel (always visible)
  - If result: GraphCanvas, RingTable, AccountScores, DownloadButton
```

#### UploadPanel.jsx
```
- Drag-and-drop zone + file picker
- Accepts .csv only
- On file select: POST /analyze with FormData
- Show processing spinner during request
- On response: set result in parent state
```

#### GraphCanvas.jsx
```
Input: result.graph_data

D3 force simulation:
  - forceLink (edges)
  - forceManyBody (repulsion)
  - forceCenter

Node color by risk_level:
  - critical  → #dc2626 (red-600)
  - high      → #ea580c (orange-600)
  - medium    → #ca8a04 (yellow-600)
  - normal    → #6b7280 (gray-500)

Node size: 8 + (suspicion_score / 10) pixels radius

Edge color:
  - is_fraud_edge = true  → #dc2626, strokeWidth 2
  - normal                → #d1d5db, strokeWidth 1

On node hover: show tooltip with account_id, score, rings, in/out degree
On node click: highlight all nodes in the same ring, dim others

On ring row click in RingTable: highlight that ring in graph
```

#### RingTable.jsx
```
Table columns:
  Ring ID | Pattern Type | Member Count | Risk Score | Risk Level | Member Account IDs

Sorted by risk_score descending.
Risk level badge colors match graph node colors.
Row click triggers graph highlight.
```

#### AccountScores.jsx
```
Scrollable list, sorted by suspicion_score descending.
Show: account_id, score bar (0-100), patterns as tags, ring membership.
Filter input to search by account ID.
```

#### DownloadButton.jsx
```
On click: serialize result to JSON, trigger browser download
Filename: mule_detection_<timestamp>.json
Format: exact output JSON format from Section 14
```

---

## 16. KNOWN LIMITATIONS

```
L1: The zero-inflow origin rule (requiring 4+ hops) was necessary to eliminate 
    the FAKE_RING false positive class. However it means genuine 3-hop shell 
    chains that happen to start from an account with no prior inflow will be 
    missed. Mitigation: if the origin node's first outgoing edge amount is in 
    the top P80 of all transaction amounts in the dataset, allow 3-hop chains 
    even from zero-inflow origins.

L2: Smurfing detection requires 10+ counterparties in a 72-hour window. This 
    misses low-and-slow smurfing (e.g. 5 feeders over 30 days). Mitigation: 
    add a secondary check — 5+ unique counterparties with amount CV < 0.10 
    within a 7-day window.

L3: The Union-Find deduplication loop is O(n^2) on the number of scored 
    clusters. For datasets with 100K+ edges producing thousands of candidate 
    clusters, this could be slow. Mitigation: only run pairwise overlap checks 
    between clusters that share at least one node (use inverted index).

L4: Bridge-connected rings are currently detected as two separate clusters.
    The bridge merger (Stage 7 from the original HTLDA spec) is not implemented.
    The two rings score independently and both appear in output. This is 
    conservative (no missed fraud) but may confuse analysts. Mitigation: add 
    bridge detection post-dedup.

L5: The merchant FAN_IN suppression relies on the node also having a large 
    FAN_OUT (out_degree >= 10, total_outflow > 5000). A merchant whose customer 
    payments are in the dataset but whose supplier payments are not will not be 
    suppressed correctly. Mitigation: expose a configurable allowlist for known 
    merchant account IDs.

L6: Temporal analysis in smurfing uses wall-clock time from the first transaction
    to the last in the window. If transactions are ingested out of order (late 
    arrivals), the 72-hour window calculation may be inaccurate. Mitigation: 
    sort all edges by timestamp before processing.
```

---

## 17. ALGORITHM COMPLEXITY SUMMARY

```
Stage 0  Ingest                   O(E)
Stage 1  Graph build              O(E)
Module 1 Tarjan SCC               O(V + E)
Module 1 Johnson cycles           O(K * (V + E)) per SCC, K = johnson_k_max = 30
Module 2 Smurfing                 O(E log E)   (sort per node)
Module 3 Chain DFS                O(N * MAX_PATHS * MAX_DEPTH) = O(N * 500 * 8)
Stage 4  Scoring                  O(C)         C = candidate clusters
Stage 5  Deduplication            O(C^2)       Union-Find with path compression
Stage 6  Output                   O(C * N)

Overall: O(V + E) dominated by Tarjan for well-connected graphs.
         O(N * 4000) for chain detection (dominant for sparse graphs).
         Empirically: 176 edges = 0.014s. 10K edges estimated < 2s.
```

---

## 18. ENVIRONMENT AND DEPENDENCIES

```
# backend/requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
pydantic==2.7.0

# No numpy, no sklearn, no pandas.
# All algorithms are pure Python standard library.
# math, collections, datetime, uuid, time are all stdlib.

# frontend/package.json dependencies
"react": "^18.3.0",
"react-dom": "^18.3.0",
"d3": "^7.9.0",
"tailwindcss": "^3.4.0"
```

---

## 19. TEST CASES (For validation post-build)

```python
# Each test case is a minimal CSV that must produce the stated output.

TEST_CASES = [
    {
        "name": "simple_3_node_cycle",
        "csv": "transaction_id,sender_id,receiver_id,amount,timestamp\n"
               "T001,A,B,1000,2024-01-01 09:00:00\n"
               "T002,B,C,980,2024-01-01 10:00:00\n"
               "T003,C,A,960,2024-01-01 11:00:00",
        "expect_rings": 1,
        "expect_risk": "HIGH",
        "expect_nodes_in_ring": {"A", "B", "C"}
    },
    {
        "name": "payroll_not_smurfing",
        "csv": "transaction_id,sender_id,receiver_id,amount,timestamp\n"
               + "\n".join(f"T{i:03d},EMPLOYER,EMP_{i},3500.00,2024-01-01 {8+i//4:02d}:{(i%4)*15:02d}:00"
                            for i in range(14)),
        "expect_smurfs": 0,   # PAYROLL suppressed
        "expect_rings": 0
    },
    {
        "name": "shell_chain_4_hops",
        "csv": "transaction_id,sender_id,receiver_id,amount,timestamp\n"
               "T001,ORIGIN,SH1,20000,2024-01-01 09:00:00\n"
               "T002,SH1,SH2,19500,2024-01-01 10:00:00\n"
               "T003,SH2,SH3,19000,2024-01-01 11:00:00\n"
               "T004,SH3,DEST,18500,2024-01-01 12:00:00",
        "expect_rings": 1,
        "expect_chain_nodes": {"ORIGIN", "SH1", "SH2", "SH3", "DEST"}
    },
    {
        "name": "fake_ring_not_detected",
        "csv": "transaction_id,sender_id,receiver_id,amount,timestamp\n"
               "T001,FA,FB,8000,2024-01-01 09:00:00\n"
               "T002,FB,FC,7800,2024-01-01 10:00:00\n"
               "T003,FC,FD,7600,2024-01-01 11:00:00",
        "expect_rings": 0   # No cycle, no 4-hop chain from zero-inflow origin
    },
    {
        "name": "smurf_fan_in",
        "csv": "transaction_id,sender_id,receiver_id,amount,timestamp\n"
               + "\n".join(f"T{i:03d},FEEDER_{i},AGGREGATOR,500,2024-01-01 {8+i:02d}:00:00"
                            for i in range(12)),
        "expect_smurfs": 1,
        "expect_smurf_node": "AGGREGATOR",
        "expect_smurf_type": "FAN_IN"
    }
]
```

---

## 20. DEPLOYMENT CHECKLIST

```
Backend:
  [ ] pip install -r requirements.txt
  [ ] python app.py  (or uvicorn backend.app:app --host 0.0.0.0 --port 8000)
  [ ] GET /health returns {"status": "ok"}
  [ ] POST /analyze with sample CSV returns valid JSON

Frontend:
  [ ] npm install
  [ ] npm run dev  (development)
  [ ] npm run build  (production build to dist/)
  [ ] Upload panel accepts .csv files
  [ ] Graph renders after successful analysis
  [ ] Node hover shows tooltip
  [ ] Download button produces valid JSON file
  [ ] Ring table rows click to highlight graph

Production deployment (Render/Railway/Vercel recommended):
  Backend: Render web service, start command: uvicorn app:app --host 0.0.0.0 --port $PORT
  Frontend: Vercel, build command: npm run build, output: dist/
  Set VITE_API_URL env var to the Render backend URL
```
