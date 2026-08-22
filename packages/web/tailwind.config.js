/** @type {import('tailwindcss').Config} */

// ── Design tokens ────────────────────────────────────────────────────────────
// "Editorial dark": a near-black ink canvas, warm cream type, and exactly one
// accent (terracotta). Everything else is separated by hairlines and space
// rather than by more boxes — that's what keeps it calm instead of busy.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Full 0–100 opacity scale. The default theme only ships a coarse set
      // (…30, 40, 50…), so a modifier like `border-cream/12` has nothing to
      // resolve against and hard-fails inside `@apply`. The hairline weights
      // this design depends on live between those stops.
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, String(i / 100)])),
      colors: {
        // Surfaces. Deliberately close together: depth comes from hairlines and
        // shadow, not from a staircase of greys.
        ink: {
          900: '#0b0b0c', // canvas — also the type color on accent fills
          800: '#111113', // card
          700: '#18181b', // popover / raised
          600: '#232327', // hover on raised
        },
        // Warm off-white. Never pure #fff — that's what reads "unfinished".
        cream: {
          DEFAULT: '#faf7f2',
          dim: '#c9c5bd',
        },
        // The single accent. `soft` is the on-board highlight (needs to survive
        // a green felt background), `deep` is for pressed/dark states.
        accent: {
          DEFAULT: '#e0603a',
          soft: '#f2894f',
          deep: '#b8451f',
        },
        ok: '#5bc08a',
        danger: '#ff4d6d',
      },
      fontFamily: {
        // Loaded in index.html. Inter was declared here before but never linked,
        // so body copy silently fell back to Segoe UI.
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
      },
      fontSize: {
        // Editorial display sizes: big, tight, and set on their own line-height.
        'display-sm': ['2.5rem', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'display': ['3.5rem', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-lg': ['4.75rem', { lineHeight: '0.94', letterSpacing: '-0.035em' }],
        // The small all-caps label that opens each section.
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
      boxShadow: {
        // One soft lift, used sparingly. Stacked shadows read as "material".
        lift: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.8)',
        pop: '0 4px 12px rgba(0,0,0,0.5), 0 24px 48px -16px rgba(0,0,0,0.9)',
        'accent-glow': '0 6px 20px -6px rgba(224,96,58,0.55)',
      },
      keyframes: {
        'dice-pop': {
          '0%': { transform: 'scale(0.4) rotate(-25deg)', opacity: '0' },
          '60%': { transform: 'scale(1.12) rotate(6deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Slow drift on the hero's background wash, so a static page still
        // feels alive without anything actually moving in the reading path.
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.08)' },
        },
        // Entrances. Everything the redesign animates is enter-only, which CSS
        // does for free — a JS animation runtime would have cost ~57kB gzip on
        // a site whose whole promise is "start in seconds".
        'rise-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'swap-in': {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'dice-pop': 'dice-pop 320ms cubic-bezier(0.2,0.8,0.2,1)',
        'fade-up': 'fade-up 220ms ease-out',
        drift: 'drift 24s ease-in-out infinite',
        'rise-in': 'rise-in 300ms cubic-bezier(0.22,1,0.36,1) both',
        'swap-in': 'swap-in 280ms cubic-bezier(0.22,1,0.36,1) both',
      },
      transitionTimingFunction: {
        // One shared easing for the whole app — mismatched curves are a big
        // part of why an interface feels assembled rather than designed.
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
