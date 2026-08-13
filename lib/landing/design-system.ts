export const landingPalette = {
  lime: "#E89BFF",
  charcoal: "#121212",
  white: "#FFFFFF",
  mutedDark: "rgba(18, 18, 18, 0.6)",
  mutedLight: "rgba(255, 255, 255, 0.6)",
} as const;

export const landingMotion = {
  ease: [0.25, 0.4, 0.25, 1] as const,
  spring: {
    type: "spring" as const,
    stiffness: 400,
    damping: 17,
  },
  softSpring: {
    type: "spring" as const,
    stiffness: 100,
    damping: 20,
  },
  scrollSpring: {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  },
} as const;

export const landingTypography = {
  display: "font-sans font-black tracking-tighter",
  eyebrow: "font-mono text-xs tracking-widest uppercase",
  bodyMono: "font-mono text-sm",
} as const;

export const landingLayout = {
  pageMaxWidth: "max-w-7xl mx-auto px-6",
  sectionPadding: "py-16",
  darkSection: "relative overflow-hidden bg-[#121212]",
  lightSection: "relative overflow-hidden bg-white",
} as const;
