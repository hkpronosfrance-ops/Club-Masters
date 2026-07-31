import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#0A0C10",
          900: "#0F1218",
          800: "#151923",
          700: "#1D2230",
          600: "#2A3142",
        },
        carmine: {
          DEFAULT: "#C81E3A",
          light: "#E8425F",
          dark: "#8F1329",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E9CE7A",
        },
        pitchgreen: "#1F8A5A",
        muted: "#8A90A2",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      clipPath: {
        corner: "polygon(0 0, 100% 0, 100% 85%, 92% 100%, 0 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
