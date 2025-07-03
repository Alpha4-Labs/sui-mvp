// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors from rewards
        'brand-primary': '#9333EA', // Purple from palette
        'brand-blue': '#007BFF',    // Blue from palette
        'brand-teal': '#4B6663',   // Teal/Gray-Green from palette
        'brand-gray': {
           lightest: '#E0E0E0',
           light:    '#D4D4D4',
           medium:   '#C1C1C1',
           dark:     '#B3B3B3',
        },
        'white': '#FFFFFF',
        'black': '#000000',

        // Map common names to palette colors
        'primary': 'var(--color-brand-primary)',
        'primary-dark': 'var(--color-brand-primary-dark)',
        'background': 'var(--color-background)',
        'background-card': 'var(--color-background-card)',
        'background-input': 'var(--color-background-input)',
        'secondary': 'var(--color-secondary)',
        'text-muted': 'var(--color-brand-gray-dark)',
        'border-color': 'var(--color-brand-gray-medium)',
      },
      animation: {
        gradient: 'gradient 15s ease infinite',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}