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

# CORS — allow Next.js dev server + Vercel deployments
# CORS configuration
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Allow all origins (Vercel preview URLs change per deploy)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths — Use /tmp/fingraphix for stateless cloud storage (cache)
# This prevents writing data into the repository directory
if os.getenv("RENDER") or os.getenv("CLOUD_DEPLOY"):
    DATA_DIR = Path("/tmp/fingraphix")
else:
    DATA_DIR = Path(os.getenv("DATA_DIR", PROJECT_ROOT / "data"))

OUTPUT_DIR = DATA_DIR / "output"
UPLOAD_DIR = DATA_DIR / "uploads"

# Ensure directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory result cache (result_id -> output dict)
result_cache: dict[str, dict] = {}

# Find sample CSV — check multiple possible locations
def _find_sample_csv() -> Path | None:
    candidates = [
        Path(__file__).resolve().parent / "transactions.csv",         # deployed with backend
        PROJECT_ROOT / "data" / "transactions.csv",                   # local dev
        Path("/opt/render/project/src/data/transactions.csv"),        # Render full clone
        PROJECT_ROOT / "transactions.csv",                            # fallback
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

SAMPLE_CSV = _find_sample_csv()


@app.get("/api/debug")
async def debug_info():
    """Returns debug info about file system and paths."""
    try:
        ls_root = os.listdir(PROJECT_ROOT)
    except Exception as e:
        ls_root = str(e)
        
    try:
        ls_backend = os.listdir(Path(__file__).parent)
    except Exception as e:
        ls_backend = str(e)

    return {
        "project_root": str(PROJECT_ROOT),
        "data_dir": str(DATA_DIR),
        "sample_csv": str(SAMPLE_CSV),
        "ls_project_root": ls_root,
        "ls_backend": ls_backend,
        "env_render": os.getenv("RENDER"),
        "cwd": os.getcwd(),
    }


@app.get("/api/health")
async def health():
    """Health check for deployment."""
    return {"status": "healthy", "uptime": time.time()}


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
        
        if len(G.nodes) == 0:
             raise HTTPException(status_code=400, detail="Analysis produced empty graph. Ensure CSV has required columns: transaction_id, sender_id, receiver_id, amount, timestamp")

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
    if not SAMPLE_CSV:
        raise HTTPException(status_code=404, detail="Sample dataset not found. Ensure data/transactions.csv is deployed.")

    result_id = f"sample_{str(uuid.uuid4())[:6]}"

    try:
        # CSV → Graph
        trace = {}
        graph_json_path = UPLOAD_DIR / f"{result_id}_graph.json"
        
        # Explicit check for file existence before reading
        if not SAMPLE_CSV.exists():
             raise HTTPException(status_code=404, detail=f"Sample CSV missing at {SAMPLE_CSV}")

        G = csv_to_graph(str(SAMPLE_CSV))
        trace["nodes_after_csv_to_graph"] = len(G.nodes)
        
        if len(G.nodes) == 0:
             raise HTTPException(status_code=500, detail="Generated graph is empty (0 nodes). Check sample CSV format.")
        
        save_graph_json(G, str(graph_json_path))

        # Load and run engine
        with open(graph_json_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)
            
        trace["nodes_in_json"] = len(graph_data.get("nodes", []))
        link_key = "links" if "links" in graph_data else "edges"
        trace["edges_in_json"] = len(graph_data.get(link_key, []))
        
        # Ensure correct key for pipeline
        if "links" in graph_data and "edges" not in graph_data:
             graph_data["edges"] = graph_data["links"]

        pipeline = DetectionPipeline()
        result = pipeline.run_from_graph_json(graph_data)
        
        trace["nodes_in_pipeline_graph"] = len(pipeline.graph.nodes) if hasattr(pipeline, "graph") else "unknown"

        output = {
            "result_id": result_id,
            "trace": trace,
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

        # Cache result
        result_cache[result_id] = output

        # Return full output + status so frontend redirects but debug sees trace
        output["status"] = "complete"
        return JSONResponse(content=output)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
