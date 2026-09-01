// Type-only re-export: the Valibot-inferred shape in the server schema is the
// single source of truth, and `export type` is erased at build time, so the
// dependency-free nature of the domain layer is preserved at runtime.
export type { Recommendation as AIRecommendation } from "@/server/schema/recommendations";
