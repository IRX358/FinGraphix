import requests
import json

print("=== Testing /api/analyze/sample on Render ===")
r = requests.post("https://fingraphix-bkend.onrender.com/api/analyze/sample")
print(f"Status: {r.status_code}")
if r.status_code != 200:
    print(r.text)
    exit()

rid = r.json()["result_id"]
print(f"Result ID: {rid}")

r2 = requests.get(f"https://fingraphix-bkend.onrender.com/api/results/{rid}")
d = r2.json()
gd = d.get("graph_data", {})
nodes = gd.get("nodes", [])
edges = gd.get("edges", [])
print(f"Nodes: {len(nodes)}")
print(f"Edges: {len(edges)}")
