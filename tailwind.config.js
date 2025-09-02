/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#667eea',
          600: '#5a6fd8',
          700: '#4c5bc6',
        },
        secondary: {
          500: '#764ba2',
          600: '#6a4190',
          700: '#5e377e',
        },
        accent: {
          500: '#f093fb',
          600: '#f5576c',
        }
      },
      aspectRatio: {
        'reels': '9 / 16',
      }
    },
  },
  plugins: [],
}