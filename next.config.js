/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openweathermap.org',
        port: '',
        pathname: '/img/wn/**',
      },
    ],
  },
  reactStrictMode: true,
  env: {
    GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    OPENWEATHERMAP_API_KEY: process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig