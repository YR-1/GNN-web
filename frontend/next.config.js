/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  ...(distDir ? { distDir } : {}),
}

module.exports = nextConfig
