import requests
import os

csv_path = os.path.join(os.path.dirname(__file__), "data", "transactions.csv")
print(f"CSV path: {csv_path}")
print(f"Exists: {os.path.exists(csv_path)}")

with open(csv_path, "rb") as f:
    r = requests.post(
        "http://localhost:8000/api/analyze",
        files={"file": ("transactions.csv", f, "text/csv")},
    )

print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")
