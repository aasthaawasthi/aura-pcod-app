// Design tokens for Aura.
// "Rose Garden" palette (1 shade lighter than the initial pick): a warm
// rose/magenta identity color on a soft blush background - the palette a
// PCOD/period-tracking audience recognizes at a glance - paired with sage
// for the habits/diet side and warm gold for streaks. Two typefaces:
// Fraunces (display serif, has real character) for headings, Manrope
// (warm geometric sans) for body and UI text.

export const colors = {
  background: "#FFF5F7",
  surface: "#FFFFFF",
  surfaceSunken: "#FCE8ED",

  ink: "#3A1F26",
  inkMuted: "#9C7A82",
  border: "#F3D9E0",

  primary: "#E21C6A", // rose - identity color, cycle/phase accents
  primarySoft: "#FAD9E7",
  primaryStrong: "#9E0F47",

  secondary: "#7C9473", // sage - habits / diet / growth
  secondarySoft: "#E4EBDF",

  gold: "#B08123", // streaks, achievement
  goldSoft: "#F3E8C9",

  notice: "#B3562E",
  noticeSoft: "#F5E1D6",

  white: "#FFFFFF",
};

// The 4 phases of a cycle, in order. `fraction` is the rough share of the
// cycle each phase occupies (matches the boundaries the backend's
// phaseFromDay() uses), for drawing a proportional phase timeline.
export const CYCLE_PHASES = ["menstrual", "follicular", "fertile_window_estimate", "luteal"] as const;

export const phaseColors: Record<
  string,
  { bg: string; fg: string; label: string; shortLabel: string; description: string; fraction: number }
> = {
  menstrual: {
    bg: "#FAD9E7",
    fg: "#E21C6A",
    label: "Menstrual phase",
    shortLabel: "Period",
    description: "Your period - the lining of your uterus is shedding. Typically lasts 3-7 days.",
    fraction: 5 / 28,
  },
  follicular: {
    bg: "#E4EBDF",
    fg: "#7C9473",
    label: "Follicular phase",
    shortLabel: "Follicular",
    description: "Your body is preparing and maturing an egg for release.",
    fraction: 0.45 - 5 / 28,
  },
  fertile_window_estimate: {
    bg: "#F3E8C9",
    fg: "#705216",
    label: "Estimated fertile window",
    shortLabel: "Fertile window",
    description: "Your estimated fertile window - the days you're most likely to conceive.",
    fraction: 0.15,
  },
  luteal: {
    bg: "#EAE2F1",
    fg: "#5B3E75",
    label: "Luteal phase",
    shortLabel: "Luteal",
    description: "After ovulation and before your next period.",
    fraction: 0.4,
  },
};

export const type = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_500Medium_Italic",
  body: "Manrope_500Medium",
  bodyRegular: "Manrope_400Regular",
  bodySemi: "Manrope_700Bold",
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

// Period blood-color scale: 0 = dark brown, 5 = bright red. Shared by the
// logging UI (color picker) and the monthly summary (calendar dots + legend).
export const periodColorScale = ["#3B2412", "#6B2A1C", "#8C2A22", "#A82A28", "#C42730", "#E0263B"];
export const periodColorLabels = ["Dark brown", "Brown", "Rust", "Red-brown", "Red", "Bright red"];

export const periodFlowSizes: Record<"light" | "medium" | "heavy", number> = {
  light: 14,
  medium: 21,
  heavy: 28,
};
