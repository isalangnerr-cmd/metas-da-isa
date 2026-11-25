/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), panel: v('panel'), panel2: v('panel2'), ink: v('ink'), muted: v('muted'),
        line: v('line'), moss: v('moss'), terra: v('terra'), sun: v('sun'), bark: v('bark'), sky: v('sky'), plum: v('plum'),
      },
      fontFamily: {
        pixel: ['"Pixelify Sans"', 'monospace'],
        hud: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        body: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        px: '0 1px 2px rgb(var(--shadow) / 0.04), 0 1px 1px rgb(var(--shadow) / 0.02)',
        pxs: '0 1px 2px rgb(var(--shadow) / 0.10)',
      },
    },
  },
  plugins: [],
};
