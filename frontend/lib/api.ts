/**
 * API utility — resolves the backend base URL for direct calls.
 *
 * In production the browser hits the Render backend directly (CORS).
 * In local dev it uses relative paths that Next.js rewrites proxy.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://fingraphix-bkend.onrender.com"

/**
 * Returns the full URL for a backend API path.
 * Example: getBackendUrl("/api/analyze/sample") =>
 *   "https://fingraphix-bkend.onrender.com/api/analyze/sample"  (production)
 *   "/api/analyze/sample"                                        (local dev with proxy)
 */
export function getBackendUrl(path: string): string {
  // In production builds on Vercel, call backend directly
  if (typeof window !== "undefined" && BACKEND_URL !== "http://localhost:8000") {
    return `${BACKEND_URL}${path}`
  }
  // During local development, use Next.js rewrites (relative path)
  return path
}
