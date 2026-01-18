/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color aliases for easy reference
        surface: {
          DEFAULT: '#18181b', // zinc-900
          dark: '#09090b',    // zinc-950
        }
      }
    },
  },
  plugins: [],
}
