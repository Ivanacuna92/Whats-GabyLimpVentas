/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/web/react/index.html",
    "./src/web/react/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navetec': {
          'primary': '#',
          'primary-dark': '#002B53',
          'primary-medium': '#AE3A8D',
          'primary-light': '#1F49B6',
          'secondary-1': '#425CC7',
          'secondary-2': '#87A9E2',
          'secondary-3': '#6FB1C8',
          'secondary-4': '#002B53',
        }
      },
      fontFamily: {
        'merriweather': ['Merriweather Sans', 'sans-serif'],
        'futura': ['Futura PT', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}