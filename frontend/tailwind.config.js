// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}", // Scan all relevant files in src
    ],
    theme: {
      extend: {
         // Add custom theme extensions here (colors, fonts, animations, etc.)
         colors: {
           // Example: Define custom purple shades if needed
           'brand-purple': {
             light: '#a855f7', // purple-500
             DEFAULT: '#9333ea', // purple-600
             dark: '#7e22ce', // purple-700
           },
            'brand-pink': {
               DEFAULT: '#db2777', // pink-600
            },
             'brand-teal': {
               DEFAULT: '#14b8a6', // teal-500
             },
         },
         fontFamily: {
           // Example: Define custom fonts if needed
           // sans: ['Inter', 'sans-serif'],
         },
         keyframes: {
           'fade-in': {
             '0%': { opacity: '0', transform: 'translateY(10px)' },
             '100%': { opacity: '1', transform: 'translateY(0)' },
           },
           // Add the gradient animation if using the CSS class
           'gradient-bg': {
               '0%, 100%': { backgroundPosition: '0% 50%' },
               '50%': { backgroundPosition: '100% 50%' },
             },
         },
         animation: {
           'fade-in': 'fade-in 0.5s ease-out forwards',
           'gradient-bg': 'gradient-bg 15s ease infinite', // Link keyframes
         },
      },
    },
    plugins: [
       // Add any Tailwind plugins here (e.g., @tailwindcss/forms)
       // require('@tailwindcss/forms'),
    ],
  }