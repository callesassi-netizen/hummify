import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark base + neon accents
        ink: {
          950: "#070512",
          900: "#0B0820",
          800: "#120D2E",
          700: "#1A1340",
        },
        neon: {
          violet: "#8B5CF6",
          pink:   "#EC4899",
          blue:   "#3B82F6",
          cyan:   "#22D3EE",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 60px -10px rgba(139, 92, 246, 0.55)",
        "glow-pink": "0 0 80px -10px rgba(236, 72, 153, 0.55)",
        card: "0 30px 80px -30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "radial-violet":
          "radial-gradient(120% 80% at 50% 0%, rgba(139,92,246,0.25) 0%, rgba(7,5,18,0) 60%)",
        "radial-pink":
          "radial-gradient(80% 60% at 80% 100%, rgba(236,72,153,0.18) 0%, rgba(7,5,18,0) 60%)",
        "grain":
          "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>\")",
      },
      animation: {
        "pulse-slow": "pulse 3.5s cubic-bezier(0.4,0,0.6,1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
