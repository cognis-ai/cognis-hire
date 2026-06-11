/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Cognis brand sweep (theming spec §5.3, gate2 item 14): the app's
        // accent is ~84 hardcoded `indigo-*` utility classes across 27
        // upstream files, so the scale is remapped here (config layer) instead
        // of recoloring every file. Values come from @cognis/design-tokens
        // (cognis-platform/packages/design-tokens/tokens.json); the fork can't
        // import the package (yarn/standalone repo), so commented literals are
        // the sanctioned brand-sweep mechanism. Unlisted shades keep Tailwind
        // defaults (only 100/200/300/400/500/600/800 are used in src/).
        // NOTE (gate2 14b): 500/600 invert Tailwind's usual lightness order —
        // hover:indigo-500 is now DARKER than indigo-600 (Ordina hover
        // darkens). Flagged for visual hover/disabled-state review.
        indigo: {
          100: "#e6f5ff", // token: color.brand.primary-tint
          200: "#cce9ff", // token: color.brand.primary-tint-2
          300: "#9ac9e2", // token: color.brand.soft-blue
          400: "#9ac9e2", // token: color.brand.soft-blue
          500: "#0087e6", // token: color.brand.primary-hover
          600: "#0099ff", // token: color.brand.primary
          800: "#006092", // token: color.brand.primary-dark
        },
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar-hide")],
};
