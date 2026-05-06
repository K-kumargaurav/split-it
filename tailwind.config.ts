import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "#0E1116",
        card: "#161B22",
        border: "rgba(255,255,255,0.05)",
        "text-primary": "#F5F7FA",
        "text-secondary": "#8B93A7",
        accent: "#00C896",
        "accent-muted": "rgba(0,200,150,0.1)",
        error: "#FF4757",
        warning: "#FFB020",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
        button: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        elevated: "0 8px 32px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
