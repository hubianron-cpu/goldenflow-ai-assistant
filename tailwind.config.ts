import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        gold: "#c7a45b",
        mint: "#7dbf9d",
        paper: "#faf9f6"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(17, 17, 17, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
