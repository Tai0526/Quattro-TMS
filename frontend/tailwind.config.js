/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e8f0fb',
          100: '#c5d6f5',
          500: '#2E5FA3',
          600: '#1F3864',
          700: '#17295a',
        },
        amber: {
          400: '#F59E0B',
          100: '#FEF3C7',
        },
      },
    },
  },
  plugins: [],
}
