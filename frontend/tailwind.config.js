/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#06080c",
        surface: "#0a0c10",
        surfaceHover: "#161616",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "#707070",
        border: "rgba(11, 84, 230, 0.05)",
      },
      fontFamily: {
        sans: ["Sora", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      zIndex: {
        modal: "1050",
      },
    },
  },
  plugins: [],
}
