/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "../plugins/!(node_modules)/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#151312",
        surface: "#1d1b1a",
        surfaceHover: "#262423",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "#707070",
        border: "rgba(11, 84, 230, 0.05)",
        // Prism Basalt Palette
        "basalt-950": "#0c0a09",
        "basalt-900": "#151312",
        "basalt-850": "#181514",
        "basalt-800": "#1c1917",
        "basalt-750": "#23201e",
        "basalt-border": "#292524",
        "basalt-border-hover": "#474745",
        "basalt-text": "#f5f5f4",
        "basalt-muted": "#a8a29e",
        "basalt-subtle": "#78716c",
        "semantic-success": "#34d399",
        "semantic-error": "#f87171",
        "gradient-peach": "#f97316",
        "gradient-lavender": "#818cf8",
        "gradient-mint": "#2dd4bf",
      },
      fontFamily: {
        sans: ["Inter", "Sora", "system-ui", "sans-serif"],
        serif: ["EB Garamond", "Instrument Serif", "serif"],
        display: ["EB Garamond", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      zIndex: {
        modal: "1050",
      },
    },
  },
  plugins: [],
}
