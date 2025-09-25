/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/web/react/index.html",
    "./src/web/react/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navetec: {
          primary: "#0B7239",
          "primary-dark": "#47B8B7",
          "primary-medium": "#73B191",
          "primary-light": "#47B8B7",
          "secondary-1": "#73B191",
          "secondary-2": "#73B191",
          "secondary-3": "#73B191",
          "secondary-4": "#73B191",
        },
      },
      fontFamily: {
        merriweather: ["Merriweather Sans", "sans-serif"],
        futura: ["Futura PT", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
