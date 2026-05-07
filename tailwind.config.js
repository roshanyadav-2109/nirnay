/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // The "navy" token is now a stone neutral — used for primary text/dark UI.
        navy: {
          50: '#F5F5F4',
          100: '#E7E5E4',
          200: '#D6D3D1',
          300: '#A8A29E',
          400: '#78716C',
          500: '#44403C',
          600: '#292524',
          700: '#1C1917',
          800: '#0C0A09',
          900: '#0C0A09',
        },
        // "cream" is the warm off-white surface system.
        cream: {
          50: '#FFFFFF',
          100: '#FFFFFF',
          200: '#FAFAF9',
          300: '#F5F5F4',
          400: '#E7E5E4',
        },
        // "gold" token is now near-black — used for primary actions and accents.
        gold: {
          50: '#F5F5F4',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#A8A29E',
          400: '#0C0A09',
          500: '#1C1917',
          600: '#292524',
        },
        // Status colors — desaturated for the muted minimalist palette.
        verdict: {
          eligible: '#15803D',
          'eligible-bg': '#F0FDF4',
          'not-eligible': '#B91C1C',
          'not-eligible-bg': '#FEF2F2',
          review: '#A16207',
          'review-bg': '#FEFCE8',
        },
        ink: '#0C0A09',
        canvas: '#FAFAF9',
        rule: '#E7E5E4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        soft: '0 1px 0 rgba(12,10,9,0.04), 0 1px 2px rgba(12,10,9,0.04)',
        card: '0 1px 0 rgba(12,10,9,0.04), 0 4px 16px rgba(12,10,9,0.04)',
        ring: '0 0 0 1px rgba(12,10,9,0.06)',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};
