import requests
import json
import os

# Test file upload to Render backend
print("=== Testing File Upload to Render ===")
BACKEND_URL = "https://fingraphix-bkend.onrender.com"
csv_file = os.path.join(os.path.dirname(__file__), "data", "transactions.csv")

with open(csv_file, "rb") as f:
    files = {"file": ("transactions.csv", f, "text/csv")}
    r = requests.post(f"{BACKEND_URL}/api/analyze", files=files)

print(f"POST /api/analyze: {r.status_code}")
if r.status_code != 200:
    print(r.text)
    exit()

j = r.json()
rid = j["result_id"]
print(f"Result ID: {rid}")

r2 = requests.get(f"{BACKEND_URL}/api/results/{rid}")
print(f"GET /api/results/{rid}: {r2.status_code}")
d = r2.json()

print(f"\n=== Response Structure ===")
print(f"Top-level keys: {list(d.keys())}")
print(f"Suspicious accounts: {len(d.get('suspicious_accounts', []))}")
print(f"Fraud rings: {len(d.get('fraud_rings', []))}")

gd = d.get("graph_data", {})
print(f"Graph data keys: {list(gd.keys())}")
print(f"Graph nodes: {len(gd.get('nodes', []))}")
print(f"Graph 'edges': {len(gd.get('edges', []))}")
print(f"Graph 'links': {len(gd.get('links', []))}")

s = d.get("summary", {})
print(f"\n=== Summary ===")
print(json.dumps(s, indent=2))

# Show what the dashboard expects vs what we have
print(f"\n=== Dashboard expects: graph_data.edges ===")
if gd.get("edges"):
    print(f"  edges[0] keys: {list(gd['edges'][0].keys())}")
elif gd.get("links"):
    print(f"  'edges' is EMPTY but 'links' has {len(gd['links'])} items")
    print(f"  links[0] keys: {list(gd['links'][0].keys())}")
else:
    print("  BOTH edges and links are EMPTY!")

if gd.get("nodes"):
    print(f"  nodes[0]: {json.dumps(gd['nodes'][0], indent=2)}")
