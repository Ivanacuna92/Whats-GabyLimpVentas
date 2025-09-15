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
          'primary': '#AE3A8D',
          'primary-dark': '#FD3244',
          'primary-medium': '#AE3A8D',
          'primary-light': '#AE3A8D',
          'secondary-1': '#AE3A8D',
          'secondary-2': '#AE3A8D',
          'secondary-3': '#AE3A8D',
          'secondary-4': '#AE3A8D',
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