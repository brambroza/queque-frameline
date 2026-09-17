import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ให้ class `font-sans` ชี้ไป Kanit (next/font ใน layout.tsx) แทน stack default ของ Tailwind
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        // อ้างอิง CSS variables ใน globals.css เพื่อให้ flip ตาม light/dark ได้อัตโนมัติ
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        line: 'var(--line)',
        content: 'var(--text)',
        muted: 'var(--muted)',
        brand: {
          50: '#e9fbf1',
          100: '#c9f4dd',
          200: '#97e8bf',
          300: '#5dd79c',
          400: '#2ec37c',
          500: '#12a862',
          600: '#0b8d51',
          700: '#0a7043',
          800: '#0b5937',
          900: '#0a482e',
          DEFAULT: 'var(--brand)'
        }
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)'
      }
    }
  },
  plugins: []
};

export default config;
