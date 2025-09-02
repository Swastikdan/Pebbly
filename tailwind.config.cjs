const { heroui } = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "#ffffff",
            foreground: "#111111",
          },
        },
        dark: {
          colors: {
            background: "#111111",
            foreground: "#ffffff",
          },
        },
      },
      layout: {
        radius: {
          small: "8px",
          medium: "12px",
          large: "14px",
        },
        borderWidth: {
          small: ".5px",
          medium: "1px",
          large: "2px",
        },
        disabledOpacity: "0.4",
      },
    }),
  ],
};

module.exports = config;
