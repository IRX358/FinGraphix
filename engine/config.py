"""
Engine configuration with all detection thresholds and scoring weights.
"""

from dataclasses import dataclass


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
