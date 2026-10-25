import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cabinet: {
          50: "#f5f7fa",
          100: "#e4e9f0",
          200: "#cdd7e6",
          300: "#a9bbd4",
          400: "#7e9bbf",
          500: "#4a6fa5",
          600: "#385a8c",
          700: "#2c4c7c",
          800: "#263f67",
          900: "#1a2e4c",
          950: "#0f1b2e",
        },
        gold: {
          50: "#fdf8ed",
          100: "#f9edd4",
          200: "#f2d9a8",
          300: "#eabf73",
          400: "#e1a045",
          500: "#c78124",
          600: "#a8651b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 12s ease-in-out infinite both",
        reveal: "reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up": "slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-reveal": "slideReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
        marquee: "marquee 112s linear infinite",
        "marquee-reverse": "marqueeReverse 112s linear infinite",
        "ken-burns": "kenBurns 5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(2rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-1.5rem) translateX(0.5rem)" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(2.5rem)", filter: "blur(8px)" },
          to: { opacity: "1", transform: "translateY(0)", filter: "blur(0px)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(1.5rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideReveal: {
          from: { opacity: "0", transform: "translateY(1.25rem) scale(0.98)", filter: "blur(6px)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)", filter: "blur(0px)" },
        },
        kenBurns: {
          from: { transform: "scale(1.08) translate(-1.5%, -1%)" },
          to: { transform: "scale(1) translate(1%, 0.5%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeReverse: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
