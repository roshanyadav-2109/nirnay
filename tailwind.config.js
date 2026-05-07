/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#E6EAF0',
          100: '#C0CADB',
          200: '#8A9CB7',
          300: '#5C7193',
          400: '#2F4870',
          500: '#1B3358',
          600: '#142747',
          700: '#0F1E37',
          800: '#0A1628',
          900: '#070F1C',
        },
        cream: {
          50: '#FFFFFE',
          100: '#FDFDF8',
          200: '#FAFAF5',
          300: '#F4F4EB',
          400: '#EBEBDC',
        },
        gold: {
          50: '#FBF6E8',
          100: '#F4E7BD',
          200: '#EBD68A',
          300: '#E0C158',
          400: '#D4A843',
          500: '#B8902F',
          600: '#977125',
        },
        verdict: {
          eligible: '#059669',
          'eligible-bg': '#D1FAE5',
          'not-eligible': '#DC2626',
          'not-eligible-bg': '#FEE2E2',
          review: '#D97706',
          'review-bg': '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(10,22,40,0.04), 0 4px 12px rgba(10,22,40,0.06)',
        card: '0 1px 3px rgba(10,22,40,0.06), 0 8px 24px rgba(10,22,40,0.08)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};
