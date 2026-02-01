/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'gh-dark': '#0d1117',
        'gh-darker': '#010409',
        'gh-border': '#30363d',
        'gh-text': '#c9d1d9',
        'gh-text-muted': '#8b949e',
        'gh-green': '#238636',
        'gh-green-hover': '#2ea043',
        'gh-red': '#da3633',
        'gh-red-hover': '#f85149',
        'gh-blue': '#58a6ff',
        'gh-purple': '#a371f7',
      }
    },
  },
  plugins: [],
}
