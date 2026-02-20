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
- **Language/Environment**: Select **Python 3** (⚠️ DO NOT select Node)
- **Root Directory**: `backend`
- **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
- **Start Command**: `python -m uvicorn app:app --host 0.0.0.0 --port $PORT`
- **Instance Type**: Select the "Free" tier.

### 4. Set Environment Variables
- Click **Advanced** -> **Add Environment Variable**:
  - `PYTHON_VERSION`: `3.11.6`
  - `RENDER`: `true`
  - `ALLOWED_ORIGINS`: Set this to your Vercel URL.

### 5. Final Checks
- **Health Check**: Visit your Render URL + `/api/health`. It should return `{"status": "healthy", ...}`.
- **Statelessness**: Remember that results are cached in `/tmp`. If the server restarts, legacy results will be cleared.

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

## Troubleshooting

### 1. Vercel: `ERR_PNPM_OUTDATED_LOCKFILE`
If Vercel fails with a lockfile error (e.g., "pnpm-lock.yaml is not up to date"), it's because dependencies were added (like `d3`) but the lockfile wasn't updated.

**Fix Option A (Preferred)**: 
In your Vercel Dashboard, go to **Settings** > **General** > **Build & Development Settings**.
- Override the **Install Command** to: `pnpm install --no-frozen-lockfile`

**Fix Option B**: 
If you have multiple lockfiles (e.g., both `pnpm-lock.yaml` and `package-lock.json`), delete the one you aren't using. Vercel prefers `pnpm` if it sees the `.yaml` file.

### 2. Render: Build Errors (Maturin/Rust)
Ensure `PYTHON_VERSION` is set to `3.11.6` in Environment Variables. This forces Render to use pre-built packages (wheels) so it doesn't try to compile `pydantic-core` from scratch using Rust.

### 3. Render: `package.lock` / `package.json` missing
If you see an error about `package.json` or `package.lock` missing on Render, it means Render thinks your backend is a Node.js app.

**Fix**:
1. Go to **Settings** in the Render dashboard.
2. Find the **Environment** or **Language** setting.
3. Change it to **Python 3**.
4. Double check your **Build Command** and **Start Command** match the guide above.
