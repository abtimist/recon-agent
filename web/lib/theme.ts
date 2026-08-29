/**
 * Theme tokens for the Recon Agent frontend.
 *
 * Dark theme with neon-lime accent (#AAFF00).
 * Matches the color scheme from the reference images.
 */

export const theme = {
  colors: {
    // Core
    background: "#0d0d0d",
    foreground: "#e8e8e8",

    // Accent - Neon Lime
    accent: "#aaff00",
    accentHover: "#ccff33",
    accentDim: "#88cc00",

    // Surfaces
    card: "#141414",
    border: "#2a2a2a",

    // Semantic
    muted: "#666666",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",

    // Status badges
    badgeSuccess: "rgba(34, 197, 94, 0.2)",
    badgeSuccessText: "#22c55e",
    badgeWarning: "rgba(245, 158, 11, 0.2)",
    badgeWarningText: "#f59e0b",
    badgeError: "rgba(239, 68, 68, 0.2)",
    badgeErrorText: "#ef4444",
    badgeInfo: "rgba(170, 255, 0, 0.2)",
    badgeInfoText: "#aaff00",
    badgeNeutral: "rgba(102, 102, 102, 0.2)",
    badgeNeutralText: "#666666",
  },

  // Spacing scale
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },

  // Border radius
  borderRadius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "10px",
    full: "9999px",
  },

  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },

  // Transitions
  transitions: {
    fast: "0.15s ease",
    normal: "0.2s ease",
    slow: "0.3s ease",
  },

  // Typography
  typography: {
    fontFamily: {
      sans: "Geist, system-ui, sans-serif",
      mono: "Geist Mono, monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
  },
} as const;

// Type-safe theme access
export type Theme = typeof theme;