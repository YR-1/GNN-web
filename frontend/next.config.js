/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    'plotly.js',
    'plotly.js-dist-min',
    'plotly.js/lib/core',
    'plotly.js/lib/heatmap',
    'plotly.js/lib/scatter',
    'react-plotly.js',
  ],
  ...(distDir ? { distDir } : {}),
}

module.exports = nextConfig
