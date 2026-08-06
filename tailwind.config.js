import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Outfit',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        serif: ['"Noto Serif"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        base: 'var(--fmp-cream)',
        fmp: {
          DEFAULT: '#EE2A42',
          light: '#FBD7DC',
          dark: '#D32238',
          pressed: '#B81E32',
          muted: 'rgba(238,42,66,0.08)',
          50: '#FBD7DC',
          100: '#FBD7DC',
          200: '#F9BAC2',
          300: '#F08E9A',
          400: '#EE2A42',
          500: '#EE2A42',
          600: '#D32238',
          700: '#B81E32',
          800: '#9A1B2A',
          900: '#7B1621',
        },
        ink: {
          DEFAULT: '#191818',
          2: '#3A3838',
          3: '#6E6B66',
        },
        cream: '#EFEEEA',
        paper: '#F6F5F1',
        sand: '#BFBAA4',
        success: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
          dark: '#166534',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
          dark: '#92400E',
        },
        danger: {
          DEFAULT: '#EE2A42',
          light: '#FBD7DC',
          dark: '#B81E32',
        },
        info: {
          DEFAULT: '#0EA5E9',
          light: '#E0F2FE',
          dark: '#075985',
        },
        dark: {
          DEFAULT: '#000000',
          2: '#191818',
          3: '#2A2728',
        },
        line: {
          DEFAULT: '#DEDCD4',
          2: '#CFCCBF',
        },
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
        lg: '28px',
        xl: '44px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(25,24,24,.06), 0 1px 3px rgba(25,24,24,.05)',
        'card-hover':
          '0 4px 12px rgba(25,24,24,.08), 0 2px 4px rgba(25,24,24,.05)',
        'glow': '0 4px 12px rgba(238,42,66,.18)',
        soft: '0 1px 2px rgba(25,24,24,.06), 0 1px 3px rgba(25,24,24,.05)',
        md: '0 4px 12px rgba(25,24,24,.08), 0 2px 4px rgba(25,24,24,.05)',
        lg: '0 18px 40px rgba(25,24,24,.12), 0 6px 14px rgba(25,24,24,.07)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-right': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '80%,100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-right': 'slide-right 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [containerQueries],
};
