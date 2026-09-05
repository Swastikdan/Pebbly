/**
 * Era presets for the recommendation filters. Kept out of the UI component
 * so pure modules (`lib/recommendation-options.ts`) can map selected era
 * labels to year ranges without importing from a `.tsx` file (a layering
 * inversion: shared logic must not depend on component modules).
 */
export const ERA_PRESETS = [
  { label: "Classics", from: 1900, to: 1979 },
  { label: "80s", from: 1980, to: 1989 },
  { label: "90s", from: 1990, to: 1999 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2020s", from: 2020, to: 2029 },
] as const;
