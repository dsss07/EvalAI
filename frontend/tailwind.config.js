/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nava: {
          primary: "rgb(var(--color-nava-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-nava-secondary) / <alpha-value>)",
          blue: "rgb(var(--color-nava-blue) / <alpha-value>)",
          teal: "rgb(var(--color-nava-teal) / <alpha-value>)",
          border: "rgb(var(--color-nava-border) / <alpha-value>)",
          text: "rgb(var(--color-nava-text) / <alpha-value>)",
          muted: "rgb(var(--color-nava-muted) / <alpha-value>)",
        }
      }
    },
  },
  plugins: [],
}
