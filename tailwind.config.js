/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', '-apple-system', 'Vazirmatn', 'Tahoma', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      colors: {
        accent: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        win: {
          bg: '#f3f3f3',
          panel: '#fbfbfb',
          dark: '#202020',
          darkpanel: '#2b2b2b',
        },
      },
      boxShadow: {
        window: '0 32px 64px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.25)',
        flyout: '0 16px 40px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.08)',
        icon: '0 1px 3px rgba(0,0,0,0.3)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(40px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'boot-dot': {
          '0%': { transform: 'translateX(-40px)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateX(40px)', opacity: '0' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        'window-open': {
          from: { opacity: '0', transform: 'scale(0.92) translateY(12px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.2,0.9,0.3,1) both',
        'slide-up': 'slide-up 260ms cubic-bezier(0.2,0.9,0.3,1) both',
        'slide-down': 'slide-down 220ms cubic-bezier(0.2,0.9,0.3,1) both',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.2,0.9,0.3,1) both',
        'spin-slow': 'spin-slow 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'window-open': 'window-open 200ms cubic-bezier(0.2,0.9,0.3,1) both',
      },
    },
  },
  plugins: [],
};
