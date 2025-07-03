// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Partner Dashboard Theme - Dark/Light adaptive
        'partner': {
          'primary': '#6366F1',    // Indigo for partner brand
          'secondary': '#8B5CF6',  // Purple accent
          'accent': '#06B6D4',     // Cyan for highlights
          'success': '#10B981',    // Green for success states
          'warning': '#F59E0B',    // Amber for warnings
          'error': '#EF4444',      // Red for errors
        },
        
        // Adaptive backgrounds
        'bg': {
          'primary': 'rgb(var(--bg-primary) / <alpha-value>)',
          'secondary': 'rgb(var(--bg-secondary) / <alpha-value>)',
          'tertiary': 'rgb(var(--bg-tertiary) / <alpha-value>)',
          'card': 'rgb(var(--bg-card) / <alpha-value>)',
          'elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        
        // Adaptive text colors
        'text': {
          'primary': 'rgb(var(--text-primary) / <alpha-value>)',
          'secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
          'muted': 'rgb(var(--text-muted) / <alpha-value>)',
          'inverse': 'rgb(var(--text-inverse) / <alpha-value>)',
        },
        
        // Adaptive borders
        'border': {
          'primary': 'rgb(var(--border-primary) / <alpha-value>)',
          'secondary': 'rgb(var(--border-secondary) / <alpha-value>)',
          'focus': 'rgb(var(--border-focus) / <alpha-value>)',
        },

        // Legacy support for existing components
        'brand-primary': '#6366F1',
        'brand-blue': '#007BFF',
        'brand-teal': '#4B6663',
        'primary': 'var(--color-primary)',
        'background': 'var(--color-background)',
        'background-card': 'var(--color-background-card)',
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