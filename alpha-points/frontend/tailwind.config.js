// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Make sure this covers all your component/page files
  ],
  theme: {
    extend: {
      colors: {
        // == Define colors from the palette ==
        'brand-primary': '#9333EA', // Purple from palette
        'brand-blue': '#007BFF',    // Blue from palette
        'brand-teal': '#4B6663',   // Teal/Gray-Green from palette
        'brand-gray': {           // Group the grays
           lightest: '#E0E0E0',   // Maps to text-gray-100/200 needs
           light:    '#D4D4D4',   // Maps to text-gray-200/300 needs
           medium:   '#C1C1C1',   // Maps to text-gray-300/400 needs
           dark:     '#B3B3B3',   // Maps to text-gray-400/500 needs
        },
        'white': '#FFFFFF',
        'black': '#000000',

        // == Map common names to palette colors (used in components) ==
        'primary': 'var(--color-brand-primary)', // Use CSS var for consistency
        'primary-dark': 'var(--color-brand-primary-dark)', // Define below or use Tailwind magic

        // == Retain/Define other necessary theme colors ==
        // Using CSS variables makes it easier to manage themes later if needed
        'background': 'var(--color-background)',
        'background-card': 'var(--color-background-card)',
        'background-input': 'var(--color-background-input)',
        'secondary': 'var(--color-secondary)', // Example: Keep amber/yellow or map to brand-blue?

        // Define default text/border colors if needed, mapping to brand-gray or default grays
        'text-muted': 'var(--color-brand-gray-dark)',
        'border-color': 'var(--color-brand-gray-medium)', // Example mapping
      },
      // Add other theme extensions like fonts, animations etc. if needed
       animation: {
           gradient: 'gradient 15s ease infinite',
           fadeIn: 'fadeIn 0.5s ease-out forwards',
       },
       keyframes: {
           gradient: {
             '0%, 100%': { backgroundPosition: '0% 50%' },
             '50%': { backgroundPosition: '100% 50%' },
           },
           fadeIn: {
              'from': { opacity: '0', transform: 'translateY(10px)' },
              'to': { opacity: '1', transform: 'translateY(0)' },
           }
       },
    },
  },
  plugins: [
     // require('@tailwindcss/forms'), // Uncomment if using form styles
  ],
}