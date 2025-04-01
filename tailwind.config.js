/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enables dark mode with a .dark class
  content: [
    './src/**/*.{js,jsx,ts,tsx}',  // Scans all JS/JSX/TS/TSX files in src
  ],
  theme: {
    extend: {
      colors: {
        'matrix-green': '#00ff00',    // Neon green for text and accents
        'matrix-blue': '#4361ee',     // Secondary neon color
        'matrix-purple': '#5d3fd3',   // Tertiary neon color
        'matrix-cyan': '#00ffff',
        'dark-bg': '#0d1117',         // Dark background
        'text-primary': '#ffffff',    // White text
        'text-secondary': '#00ff00',  // Neon green text
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],  // Clean sans-serif font
        'fira': ['Fira Code', 'monospace'], // Code-like font for terminal vibe
      },
      animation: {
        'matrix-rain': 'matrixRain 10s linear infinite', // Falling code effect
        'glitch': 'glitch 1s infinite',                  // Glitch animation
      },
      keyframes: {
        matrixRain: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(2px, -2px)' },
          '60%': { transform: 'translate(-2px, -2px)' },
          '80%': { transform: 'translate(2px, 2px)' },
        },
      },
    },
  },
  plugins: [],
}