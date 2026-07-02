/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0c1118',
          800: '#111927',
          700: '#182233',
          600: '#22304a',
        },
        felt: {
          DEFAULT: '#1f6f54',
          dark: '#155b44',
          light: '#2a8466',
        },
        wood: {
          DEFAULT: '#5a3a22',
          dark: '#43291684',
          light: '#7a5230',
        },
        cream: '#f3e9d2',
        amber: {
          glow: '#f5b14c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 3px rgba(245,177,76,0.45)',
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
      },
      animation: {
        'dice-pop': 'dice-pop 320ms cubic-bezier(0.2,0.8,0.2,1)',
        'fade-up': 'fade-up 220ms ease-out',
      },
    },
  },
  plugins: [],
};
