"""
Stage 4 — Scoring
Min-max normalizes raw scores across the batch, applies tightness bonus
and retention floor, suppresses clusters below medium threshold.
"""

from .models import Cluster
from .config import EngineConfig


def score_clusters(candidates: list, config: EngineConfig) -> list:
    """
    Min-max normalizes raw scores across the current batch.
    Applies tightness bonus and retention floor.
    Suppresses clusters below medium threshold.
    Returns scored clusters sorted by rule_score descending.
    """
    if not candidates:
        return []

    def normalize(values: list) -> list:
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
