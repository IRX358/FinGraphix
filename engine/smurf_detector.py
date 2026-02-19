"""
Module 2 — Smurfing Detection
Detects fan-in and fan-out smurfing patterns using sliding window analysis.
Includes false positive guards for payroll and merchant patterns.
"""

from uuid import uuid4
from .models import Cluster
from .config import EngineConfig


def detect_smurfing(adj: dict, radj: dict, node_stats: dict,
                    config: EngineConfig) -> list:
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
                     node_stats, config) -> tuple:
    """
    Returns (is_suppressed, reason).
    """
    # Payroll guard: ONLY applies to FAN_OUT
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
