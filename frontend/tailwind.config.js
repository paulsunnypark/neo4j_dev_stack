/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0b",
        surface: "#121214",
        surfaceHighlight: "#1e1e24",
        primary: "#6d28d9",
        secondary: "#4f46e5",
        accent: "#10b981",
        danger: "#e11d48",
        text: "#f3f4f6",
        textMuted: "#9ca3af",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
