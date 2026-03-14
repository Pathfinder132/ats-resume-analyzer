/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#0D0D0D', 50: '#F5F5F4', 100: '#E8E8E5', 200: '#D1D0CC', 400: '#9B9A94', 600: '#4A4944', 800: '#1F1E1B', 900: '#0D0D0D' },
        sage: { DEFAULT: '#2D5A3D', 50: '#EDF4EF', 100: '#D3E8D9', 300: '#7DB594', 500: '#2D5A3D', 700: '#1A3524' },
        amber: { DEFAULT: '#D97706', 50: '#FFFBEB', 100: '#FEF3C7', 300: '#FCD34D', 500: '#D97706', 600: '#B45309' },
        crimson: { DEFAULT: '#DC2626', 50: '#FEF2F2', 500: '#DC2626' }
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'score-fill': 'scoreFill 1.2s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(20px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        scoreFill: { '0%': { strokeDashoffset: '339' }, '100%': { strokeDashoffset: 'var(--offset)' } },
      }
    }
  },
  plugins: []
}
