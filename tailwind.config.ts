import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#13171f",
        panel2: "#1a1f2b",
        border: "#252b3a",
        text: "#e6e9ef",
        muted: "#8a93a6",
        accent: "#ff5722",
        win: "#22c55e",
        lose: "#ef4444"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
