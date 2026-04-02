import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Roboto", "system-ui", "sans-serif"],
        display: ["Roboto", "system-ui", "sans-serif"],
        serif: ["Roboto", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        copper: "hsl(var(--copper))",
        ivory: "hsl(var(--ivory))",
        mint: "hsl(var(--mint))",
        peach: "hsl(var(--peach))",
        "purple-glow": "hsl(var(--purple-glow))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        // Hero background breathing — imperceptibly slow
        "hero-breathe": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.015)" },
        },
        // Warm ambient light drift in hero
        "light-drift": {
          "0%, 100%": { transform: "translate(0%, 0%)" },
          "33%": { transform: "translate(1.5%, -1%)" },
          "66%": { transform: "translate(-1%, 1.5%)" },
        },
        // Metric value pulse
        "value-shimmer": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.75" },
        },
        // Icon intelligence glow
        "icon-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(28 55% 42% / 0)" },
          "50%": { boxShadow: "0 0 12px 2px hsl(28 55% 42% / 0.18)" },
        },
        // CTA button pulse
        "cta-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(28 55% 38% / 0.3)" },
          "50%": { boxShadow: "0 0 0 5px hsl(28 55% 38% / 0)" },
        },
        // Chart line draw
        "chart-draw": {
          from: { strokeDashoffset: "1000" },
          to: { strokeDashoffset: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 40s linear infinite",
        "hero-breathe": "hero-breathe 14s ease-in-out infinite",
        "light-drift": "light-drift 20s ease-in-out infinite",
        "value-shimmer": "value-shimmer 3s ease-in-out infinite",
        "icon-glow": "icon-glow 2.5s ease-in-out infinite",
        "cta-pulse": "cta-pulse 2.5s ease-in-out infinite",
        "fade-up": "fade-up 0.55s ease forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
