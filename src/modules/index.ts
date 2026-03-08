/**
 * Mushin — System Module Index
 *
 * Hierarchy:
 *   System (this file)
 *   └── Core Modules
 *       ├── search          — creator discovery, ranking, language, query expansion
 *       ├── profiles        — profile fetching and normalisation
 *       ├── enrichment      — on-demand deep analytics (bot analysis, audience)
 *       ├── campaigns       — campaign management pipeline
 *       ├── auth            — authentication and RBAC
 *       ├── dashboard       — workspace summary and stats
 *       ├── payments        — subscriptions, credits, billing
 *       ├── admin           — admin panel utilities and permissions
 *       └── support         — support ticket resource
 *
 * Import from here for cross-cutting access, or from a specific module
 * barrel (e.g. "@/modules/enrichment") for scoped access.
 *
 * RULES:
 *   - enrichment/* sub-modules NEVER auto-load on page mount (user-initiated only).
 *   - admin/* re-exports are permission-gated before calling.
 *   - payments/* hooks are safe to auto-load (read-only queries).
 */
export * from "./search";
export * from "./profiles";
export * from "./enrichment";
export * from "./campaigns";
export * from "./auth";
export * from "./dashboard";
export * from "./payments";
export * from "./admin";
export * from "./support";
export * from "./platform";
// Phase 5 additions
export * from "./platforms";
export * from "./campaign";
// Phase 6 additions
export * from "./predictive-intelligence";
// Phase 7 additions
export * from "./trend-intelligence";
export * from "./safety";
// Future AI scaffolding (no-op stubs — for planning only)
export * from "./future-ai";

