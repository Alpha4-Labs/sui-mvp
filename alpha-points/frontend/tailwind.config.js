/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: '#8B5CF6', // Purple
            dark: '#7C3AED',
            light: '#A78BFA',
          },
          secondary: {
            DEFAULT: '#10B981', // Green for points
          },
          background: {
            DEFAULT: '#1F2937', // Dark background
            card: '#111827',
            input: '#374151',
          },
        },
      },
    },
    plugins: [],
  }