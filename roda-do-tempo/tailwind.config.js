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
        hud: ['Silkscreen', 'monospace'],
        body: ['"Nunito Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        px: '4px 4px 0 0 rgb(var(--shadow))',
        pxs: '2px 2px 0 0 rgb(var(--shadow))',
      },
    },
  },
  plugins: [],
};
