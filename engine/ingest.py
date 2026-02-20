"""
Stage 0 — Ingest
Parses CSV rows or graph.json links into clean Edge objects.
Handles timestamp parsing, amount validation, self-loop rejection, deduplication.
"""

from datetime import datetime, timezone
from uuid import uuid4
from .models import Edge


def ingest(raw_rows: list) -> tuple:
    """
    Input: list of dicts with keys: transaction_id, sender_id, receiver_id, amount, timestamp
    Output: (clean_edges: list[Edge], rejection_stats: dict)
    """
    clean = []
    seen_sigs = set()
    rejected = {"dup": 0, "invalid_amount": 0, "bad_timestamp": 0, "self_loop": 0}

    for row in raw_rows:
        # Step 1: parse timestamp
        try:
            ts = parse_timestamp(row["timestamp"])
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
            tx_id=str(row.get("transaction_id", str(uuid4()))),
            amount=amount,
            timestamp=ts
        ))

    return clean, rejected


def ingest_from_graph_json(json_data: dict) -> list:
    """
    Converts NetworkX node-link JSON format (with 'nodes' and 'links'/'edges' arrays)
    into the row-dict format expected by ingest().

    NetworkX 2.x uses 'links', NetworkX 3.x uses 'edges' as the key.
    We check both for compatibility.
    """
    # NetworkX 3.x uses "edges", 2.x uses "links"
    link_list = json_data.get("links", []) or json_data.get("edges", [])

    rows = []
    for link in link_list:
        rows.append({
            "transaction_id": link.get("transaction_id", str(uuid4())),
            "sender_id": link["source"],
            "receiver_id": link["target"],
            "amount": link["amount"],
            "timestamp": link["timestamp"]
        })
    return rows


def parse_timestamp(s: str) -> int:
    """Try multiple formats, return unix epoch int UTC."""
    s = str(s).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return int(datetime.strptime(s, fmt).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            continue
    raise ValueError(f"Unparseable timestamp: {s}")
