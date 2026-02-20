/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://fingraphix-bkend.onrender.com'
    return [
      {
        source: '/api/analyze',
        destination: `${backendUrl}/api/analyze`,
      },
      {
        source: '/api/analyze/sample',
        destination: `${backendUrl}/api/analyze/sample`,
      },
      {
        source: '/api/results/:path*',
        destination: `${backendUrl}/api/results/:path*`,
      },
      {
        source: '/api/download/:path*',
        destination: `${backendUrl}/api/download/:path*`,
      },
      {
        source: '/api/health',
        destination: `${backendUrl}/api/health`,
      },
    ]
  },
}

export default nextConfig
