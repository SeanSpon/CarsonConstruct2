/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme base colors
        background: '#09090b', // zinc-950
        surface: '#18181b', // zinc-900
        border: '#27272a', // zinc-800
      },
    },
  },
  plugins: [],
}
