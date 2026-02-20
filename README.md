# FinGraphix: Money Mule Detection System

FinGraphix is a full-stack platform designed to detect and visualize money mule activities within financial transaction data. It combines a powerful Python-based detection engine with an interactive Next.js dashboard.

## 🚀 Getting Started

### Prerequisites

- **Python**: 3.9+ 
- **Node.js**: 18+ (with `npm` or `pnpm`)

### 1. Backend Setup (FastAPI)

The backend handles CSV processing and runs the graph-based detection algorithms.

```bash
cd backend
# Install dependencies
pip install -r ../requirements.txt
# Start the server
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup (Next.js)

The frontend provides the user interface for uploading data and visualizing interactive graphs.

```bash
cd frontend
# Install dependencies
npm install
# Start the development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 🛠 Features

- **Advanced Detection**: Identifies cycles, chains, and "smurfing" patterns using NetworkX.
- **Interactive Visualization**: Explore fraud rings using a D3.js powered force-directed graph.
- **Detailed Analytics**: View risk scores and pattern breakdowns for suspicious accounts.
- **Reporting**: Download analysis results in JSON format for further review.

## 🏗 Project Structure

- `engine/`: The core money mule detection logic.
- `backend/`: FastAPI application and API endpoints.
- `frontend/`: Next.js web application.
- `data/`: Sample datasets and storage for uploads/outputs.

## 🚀 Deployment

For a detailed, step-by-step guide on deploying the backend to Render and the frontend to Vercel, see **[SPLIT_DEPLOYMENT_GUIDE.md](SPLIT_DEPLOYMENT_GUIDE.md)**.

## 📝 Architecture

For a deep dive into the detection logic and system design, see [MULE_DETECTION_ARCHITECTURE.md](MULE_DETECTION_ARCHITECTURE.md).
