/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        moba: {
          darkest: '#141414',
          darker: '#1e1e1e',
          dark: '#252526',
          panel: '#2d2d30',
          border: '#3e3e42',
          hover: '#3a3a3d',
          selected: '#094771',
          accent: '#007acc',
          yellow: '#f1c40f',
          green: '#2ecc71',
          red: '#e74c3c'
        }
      }
    },
  },
  plugins: [],
}
