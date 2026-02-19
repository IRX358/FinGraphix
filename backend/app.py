"""
FastAPI Backend — FinGraphix Mule Detection Engine
Endpoints:
  POST /api/analyze     — Upload CSV, run engine, return result ID
  GET  /api/results/{id} — Fetch detection results
  GET  /api/download/{id} — Download output JSON file
"""

import json
import os
import sys
import uuid
import time
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# Add project root so engine + togh imports work
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from engine.pipeline import DetectionPipeline
from engine.togh import csv_to_graph, save_graph_json

app = FastAPI(title="FinGraphix API", version="1.0.0")

# CORS — allow Next.js dev server
# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = DATA_DIR / "output"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory result cache (result_id -> output dict)
result_cache: dict[str, dict] = {}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Upload a CSV file, run the full detection pipeline, and return results.
    """
    # Validate file type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    result_id = str(uuid.uuid4())[:8]

    try:
        # Save uploaded CSV
        csv_path = UPLOAD_DIR / f"{result_id}.csv"
        contents = await file.read()
        with open(csv_path, "wb") as f:
            f.write(contents)

        # Step 1: CSV → NetworkX graph JSON via togh.py
        graph_json_path = UPLOAD_DIR / f"{result_id}_graph.json"
        G = csv_to_graph(str(csv_path))
        save_graph_json(G, str(graph_json_path))

        # Step 2: Load graph JSON and run engine
        with open(graph_json_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        pipeline = DetectionPipeline()
        result = pipeline.run_from_graph_json(graph_data)

        # Step 3: Build output JSON
        output = {
            "result_id": result_id,
            "suspicious_accounts": [
                {
                    "account_id": a.account_id,
                    "suspicion_score": a.suspicion_score,
                    "detected_patterns": a.detected_patterns,
                    "ring_id": a.ring_id,
                }
                for a in result.suspicious_accounts
            ],
            "fraud_rings": [
                {
                    "ring_id": r.ring_id,
                    "member_accounts": r.member_accounts,
                    "pattern_type": r.pattern_type,
                    "risk_score": r.risk_score,
                    "risk_level": r.risk_level,
                }
                for r in result.fraud_rings
            ],
            "summary": result.summary,
            "graph_data": result.graph_data,
        }

        # Save to disk
        output_path = OUTPUT_DIR / f"{result_id}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

        # Cache for fast retrieval
        result_cache[result_id] = output

        return JSONResponse(content={"result_id": result_id, "status": "complete"})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/api/results/{result_id}")
async def get_results(result_id: str):
    """Return detection results for a given result_id."""
    # Check cache first
    if result_id in result_cache:
        return JSONResponse(content=result_cache[result_id])

    # Fall back to disk
    output_path = OUTPUT_DIR / f"{result_id}.json"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")

    with open(output_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    result_cache[result_id] = data
    return JSONResponse(content=data)


@app.get("/api/download/{result_id}")
async def download_results(result_id: str):
    """Download detection output as a JSON file."""
    output_path = OUTPUT_DIR / f"{result_id}.json"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")

    return FileResponse(
        path=str(output_path),
        filename=f"fingraphix_report_{result_id}.json",
        media_type="application/json",
    )


@app.post("/api/analyze/sample")
async def analyze_sample():
    """Run engine on the built-in sample dataset."""
    sample_csv = DATA_DIR / "transactions.csv"
    if not sample_csv.exists():
        raise HTTPException(status_code=404, detail="Sample dataset not found")

    result_id = f"sample_{str(uuid.uuid4())[:6]}"

    try:
        # CSV → Graph
        graph_json_path = UPLOAD_DIR / f"{result_id}_graph.json"
        G = csv_to_graph(str(sample_csv))
        save_graph_json(G, str(graph_json_path))

        # Load and run engine
        with open(graph_json_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        pipeline = DetectionPipeline()
        result = pipeline.run_from_graph_json(graph_data)

        output = {
            "result_id": result_id,
            "suspicious_accounts": [
                {
                    "account_id": a.account_id,
                    "suspicion_score": a.suspicion_score,
                    "detected_patterns": a.detected_patterns,
                    "ring_id": a.ring_id,
                }
                for a in result.suspicious_accounts
            ],
            "fraud_rings": [
                {
                    "ring_id": r.ring_id,
                    "member_accounts": r.member_accounts,
                    "pattern_type": r.pattern_type,
                    "risk_score": r.risk_score,
                    "risk_level": r.risk_level,
                }
                for r in result.fraud_rings
            ],
            "summary": result.summary,
            "graph_data": result.graph_data,
        }

        output_path = OUTPUT_DIR / f"{result_id}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

        result_cache[result_id] = output

        return JSONResponse(content={"result_id": result_id, "status": "complete"})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="[IP_ADDRESS]", port=8000, reload=True)
