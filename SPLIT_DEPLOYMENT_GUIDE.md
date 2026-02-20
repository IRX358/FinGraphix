# Step-by-Step Guide: Split Deployment (Option 2)

This guide provides a detailed walkthrough for deploying the **FinGraphix Backend** to Render and the **FinGraphix Frontend** to Vercel.

---

## Part 1: Prerequisites

1.  **GitHub Repository**: Your code must be pushed to a public or private GitHub repository.
2.  **Environment Audit**: Ensure your `.gitignore` is correct (prevents sensitive data upload).

---

## Part 2: Deploy the Backend (Render)

Render is excellent for hosting FastAPI applications.

### 1. Create a Render Account
- Go to [render.com](https://render.com) and sign up using your GitHub account.

### 2. Create a "Web Service"
- In the Render Dashboard, click **New +** and select **Web Service**.
- Connect your GitHub repository.

### 3. Configure the Service
- **Name**: `fingraphix-backend` (or similar)
- **Region**: Select the one closest to you.
- **Language**: `Python 3`
- **Root Directory**: `backend`
- **Build Command**: `pip install -r ../requirements.txt`
- **Start Command**: `python -m uvicorn app:app --host 0.0.0.0 --port $PORT`
- **Instance Type**: Select the "Free" tier.

### 4. Set Environment Variables
- Click **Advanced** -> **Add Environment Variable**:
  - `PYTHON_VERSION`: `3.10` (or higher)
  - `ALLOWED_ORIGINS`: Set this to `*` initially, or ideally, your Vercel URL once you have it (e.g., `https://fingraphix.vercel.app`).

### 5. Deploy
- Click **Create Web Service**. 
- **Note**: The Free tier "sleeps" after 15 minutes of inactivity. The first request after a sleep might take 30-60 seconds.

---

## Part 3: Deploy the Frontend (Vercel)

Vercel is the natural home for Next.js apps.

### 1. Create a Vercel Account
- Go to [vercel.com](https://vercel.com) and sign up with GitHub.

### 2. Import Project
- Click **Add New** -> **Project**.
- Import the same GitHub repository.

### 3. Configure Project Settings
- **Framework Preset**: Next.js
- **Root Directory**: Select `frontend`.
- **Build and Output Settings**: Defaults should work.

### 4. Set Environment Variables
- Expand **Environment Variables**:
  - Key: `NEXT_PUBLIC_API_URL`
  - Value: Your Render Web Service URL (e.g., `https://fingraphix-backend.onrender.com`). **Do not include a trailing slash.**

### 5. Deploy
- Click **Deploy**.

---

## Part 4: Final Connection (The "Handshake")

1.  **Verify Backend**: Visit your Render URL + `/docs` (e.g., `https://...onrender.com/docs`). You should see the FastAPI Swagger UI.
2.  **Verify Frontend**: Visit your Vercel URL.
3.  **Update CORS (Optional but Recommended)**:
    - Once your Vercel app is live, go back to Render Dashboard.
    - Change `ALLOWED_ORIGINS` from `*` to your specific Vercel URL `https://fingraphix.vercel.app`.
    - Render will automatically re-deploy.

---

## ⚠️ Important Note on Data Storage

Both Render (Free tier) and Vercel are **stateless**. 
- Uploaded CSVs and output JSONs will be deleted whenever the service restarts or re-deploys.
- This is fine for demonstrations. For a production system, you would need to connect a database (e.g., PostgreSQL) or cloud storage (e.g., Supabase, AWS S3) to persist analysis results.
