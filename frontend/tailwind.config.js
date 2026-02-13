/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        ink: {
          700: '#475569',
          800: '#1e293b',
          950: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
