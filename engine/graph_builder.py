"""
Stage 1 — Graph Build
Constructs adjacency lists (adj, radj) and NodeStats from Edge list.
"""

from collections import defaultdict
from .models import Edge, NodeStats


def build(edges: list) -> tuple:
    """
    Input: list[Edge]
    Output: (adj, radj, node_stats)

    adj[source]  = list of {target, source, amount, ts, tx_id}
    radj[target] = list of {source, target, amount, ts, tx_id}
    node_stats[id] = NodeStats
    """
    adj = defaultdict(list)
    radj = defaultdict(list)

    for e in edges:
        rec = {
            "target": e.target,
            "source": e.source,
            "amount": e.amount,
            "ts": e.timestamp,
            "tx_id": e.tx_id
        }
        adj[e.source].append(rec)
        radj[e.target].append(rec)

    all_nodes = set(adj.keys()) | set(radj.keys())
    node_stats = {}

    for n in all_nodes:
        out_e = adj[n]
        in_e = radj[n]
        node_stats[n] = NodeStats(
            account_id=n,
            in_degree=len(in_e),
            out_degree=len(out_e),
            total_inflow=sum(x["amount"] for x in in_e),
            total_outflow=sum(x["amount"] for x in out_e),
            total_tx=len(in_e) + len(out_e)
        )

    return dict(adj), dict(radj), node_stats
