# Vercel Deployment Guide: FinGraphix

Deploying the FinGraphix full-stack application to Vercel requires some adjustments because Vercel's environment is **stateless** and **serverless**. 

> [!WARNING]
> The current backend uses local file storage (`data/uploads/` and `data/output/`). On Vercel, these directories are read-only at runtime. For a production deployment, you should modify the backend to use external storage like **AWS S3**, **Google Cloud Storage**, or **Supabase Storage**.

---

## Option 1: Monorepo Deployment (Recommended)
You can host both the Next.js frontend and the FastAPI backend on Vercel using a single project.

### 1. Preparation: Backend Structure
Vercel expects Python serverless functions to be in an `api/` directory at the root.

1. Create a root `api/` folder.
2. Move (or link) `backend/app.py` to `api/index.py`.
3. Update `api/index.py` to ensure it doesn't try to create directories in the root.

### 2. Configure `vercel.json`
Create a `vercel.json` in the project root to route requests:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(.*)",
      "destination": "/frontend/$1"
    }
  ]
}
```

### 3. Environment Variables
In the Vercel Dashboard, set the following:
- `NEXT_PUBLIC_API_URL`: Set this to your Vercel deployment URL (e.g., `https://fingraphix.vercel.app`).

---

## Option 2: Split Deployment (Easiest)
Deploy the Frontend to Vercel and the Backend to a platform better suited for long-running Python processes (like **Render**, **Railway**, or **DigitalOcean**).

### Part A: Deploy Backend (e.g., on Render)
1. Connect your GitHub repo to Render.
2. Select "Web Service".
3. Root Directory: `backend`
4. Build Command: `pip install -r ../requirements.txt`
5. Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

### Part B: Deploy Frontend (Vercel)
1. Connect your GitHub repo to Vercel.
2. Root Directory: `frontend`
3. **Environment Variable**: 
   - `NEXT_PUBLIC_API_URL`: Set this to your Render service URL (e.g., `https://fingraphix-api.onrender.com`).

---

## 🚀 Step-by-Step Vercel GUI Guide

1. **Push to GitHub**: Ensure your latest changes are in a GitHub repository.
2. **Import to Vercel**: 
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your FinGraphix repository.
3. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: Select `frontend` (if using Option 2) or project root (if using Option 1 with `vercel.json`).
4. **Environment Variables**:
   - Expand the "Environment Variables" section.
   - Add `NEXT_PUBLIC_API_URL`.
5. **Deploy**: Click the "Deploy" button.

## 🛠 Troubleshooting

- **CORS Errors**: If you use Option 2, ensure the `backend/app.py` CORS configuration allows your Vercel URL.
- **Statelessness**: If your analysis fails on Vercel, it is likely because the engine is trying to write to the `data/` folder. You must update `engine/output_builder.py` and `backend/app.py` to handle data in-memory or via external APIs.
