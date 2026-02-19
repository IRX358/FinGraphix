"""
Stage 5 — Deduplication (Union-Find)
Merges clusters sharing more than overlap_merge_threshold fraction of nodes.
"""

from collections import defaultdict
from .models import Cluster
from .config import EngineConfig


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


def deduplicate(clusters: list, config: EngineConfig) -> list:
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
