import csv
import json
import sys
from pathlib import Path
import networkx as nx



def csv_to_graph(csv_path: str) -> nx.MultiDiGraph:

    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {csv_path}")

    G = nx.MultiDiGraph()  # MultiDiGraph allows multiple edges between same pair

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        # Validate required columns
        required = {"transaction_id", "sender_id", "receiver_id", "amount", "timestamp"}
        if not required.issubset(set(reader.fieldnames or [])):
            missing = required - set(reader.fieldnames or [])
            raise ValueError(f"CSV is missing columns: {missing}")

        for row in reader:
            sender    = row["sender_id"].strip()
            receiver  = row["receiver_id"].strip()
            txn_id    = row["transaction_id"].strip()
            amount    = float(row["amount"])
            timestamp = row["timestamp"].strip()

            # Add nodes (no-op if already exists)
            if not G.has_node(sender):
                G.add_node(sender, node_id=sender)
            if not G.has_node(receiver):
                G.add_node(receiver, node_id=receiver)

            # Add directed edge: sender -> receiver
            G.add_edge(
                sender,
                receiver,
                transaction_id=txn_id,
                amount=amount,
                timestamp=timestamp,
                direction=f"{sender} -> {receiver}",
            )

    return G


def save_graph_json(G: nx.MultiDiGraph, output_path: str):
    """Serializes graph to NetworkX node-link JSON format."""
    data = nx.node_link_data(G)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def print_summary(G: nx.MultiDiGraph, csv_path: str):
    print("\n" + "=" * 50)
    print(f"  Graph Summary for: {csv_path}")
    print("=" * 50)
    print(f"  Nodes (unique users) : {G.number_of_nodes()}")
    print(f"  Edges (transactions) : {G.number_of_edges()}")
    print(f"  Graph type           : Directed MultiGraph")

    out_degrees = sorted(G.out_degree(), key=lambda x: x[1], reverse=True)[:5]
    print("\n  Top 5 Senders (by # of transactions):")
    for node, deg in out_degrees:
        print(f"    {node}: {deg} outgoing transactions")

    print("\n  Sample Edges (first 3):")
    for i, (u, v, data) in enumerate(G.edges(data=True)):
        if i >= 3:
            break
        print(f"    [{data['transaction_id']}] {data['direction']} | "
              f"amount={data['amount']} | ts={data['timestamp']}")
    print("=" * 50 + "\n")


def main():
    csv_path = "./data/transactions.csv"
    output_path = str(Path(csv_path).stem) + "_graph.json"

    print(f"Reading: {csv_path}")
    G = csv_to_graph(csv_path)

    print(f"Saving graph to: {output_path}")
    save_graph_json(G, output_path)

    print_summary(G, csv_path)
    print(f"Done! Graph saved to -> {output_path}")


if __name__ == "__main__":
    main()