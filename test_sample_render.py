import requests
import json
import time
import os

print("=== Polling for Render Deployment (max 60s) ===")
for i in range(12):
    try:
        r = requests.get("https://fingraphix-bkend.onrender.com/api/debug", timeout=5)
        if r.status_code == 200:
            print("\n✅ New version deployed!")
            d = r.json()
            print(f"Project Root: {d.get('project_root')}")
            print(f"Sample CSV Path: {d.get('sample_csv')}")
            print(f"LS Backend: {d.get('ls_backend')}")
            break
        else:
            print(f".", end="", flush=True)
    except Exception as e:
        # print(f"({e})", end="", flush=True)
        print(f"x", end="", flush=True)
    time.sleep(5)
else:
    print("\n⚠️ Timed out waiting for deployment. Check Render Dashboard logs.")
    exit()

print("\n=== 2. Testing Sample Analysis ===")
try:
    r = requests.post("https://fingraphix-bkend.onrender.com/api/analyze/sample")
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"Error: {r.text}")
        exit()

    j = r.json()
    rid = j.get("result_id")
    print(f"Result ID: {rid}")

    r2 = requests.get(f"https://fingraphix-bkend.onrender.com/api/results/{rid}")
    d = r2.json()
    print(f"Keys: {list(d.keys())}")
    if "summary" in d:
        print(f"Summary: {json.dumps(d['summary'], indent=2)}")

    gd = d.get("graph_data", {})
    if not gd:
        print("graph_data is missing or empty!")
    else:
        nodes = gd.get("nodes", [])
        edges = gd.get("edges", [])
        print(f"Nodes in graph_data: {len(nodes)}")
        print(f"Edges in graph_data: {len(edges)}")
        if len(nodes) > 0:
            print(f"First node: {nodes[0]}")

except Exception as e:
    print(f"\nFailed during test: {e}")
