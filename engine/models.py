"""
Data models for the Mule Detection Engine.
All dataclasses used across the pipeline stages.
"""

from dataclasses import dataclass, field
from uuid import uuid4


@dataclass
class Edge:
    """A single directed transaction edge in the graph."""
    source: str          # account ID (sender)
    target: str          # account ID (receiver)
    tx_id: str           # unique transaction identifier
    amount: float        # in base currency (USD)
    timestamp: int       # unix epoch UTC
    amount_original: float = 0.0
    currency_original: str = "USD"

    def __post_init__(self):
        assert self.amount > 0, f"Amount must be positive, got {self.amount}"
        assert self.source != self.target, "Self-loops are not allowed"
        assert self.timestamp > 0, f"Timestamp must be positive, got {self.timestamp}"


@dataclass
class NodeStats:
    """Aggregated statistics for a single account node."""
    account_id: str
    in_degree: int
    out_degree: int
    total_inflow: float
    total_outflow: float
    total_tx: int         # in_degree + out_degree


@dataclass
class Cluster:
    """A detected suspicious cluster (cycle, chain, or smurf pattern)."""
    cluster_id: str                    # UUID4
    cluster_type: str                  # "cycle" | "chain" | "smurf_fan_in" | "smurf_fan_out"
    nodes: list                        # all member account IDs
    raw_structural_score: float        # 0-100 before normalization
    raw_velocity_score: float          # 0-100 before normalization
    raw_retention_score: float         # 0-100 before normalization
    rule_score: float                  # 0-100 after Stage 4 scoring
    risk_level: str                    # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    tightness_bonus: float = 0.0       # added to cycles with time_hrs < 48
    retention_floor: float = 0.0       # minimum score floor based on retention ratio
    time_hrs: float = 0.0              # total time span of the pattern
    amounts: list = field(default_factory=list)
    suppressed: bool = False
    suppression_reason: str = ""


@dataclass
class SuspiciousAccount:
    """A single account flagged as suspicious."""
    account_id: str
    suspicion_score: float             # 0-100, sorted descending in output
    detected_patterns: list            # e.g. ["cycle_length_3", "high_velocity"]
    ring_id: str                       # primary ring this account belongs to


@dataclass
class FraudRing:
    """A detected fraud ring grouping multiple accounts."""
    ring_id: str                       # "RING_001", "RING_002", etc.
    member_accounts: list              # sorted list of account IDs
    pattern_type: str                  # "cycle" | "chain" | "smurf" | "hybrid"
    risk_score: float
    risk_level: str


@dataclass
class DetectionResult:
    """Complete output of the detection pipeline."""
    suspicious_accounts: list          # list of SuspiciousAccount
    fraud_rings: list                  # list of FraudRing
    summary: dict                      # see output format spec
    graph_data: dict                   # nodes + edges with color/size metadata for frontend
