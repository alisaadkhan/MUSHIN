/**
 * src/modules/safety/index.ts
 * Barrel export for the Safety module (Phase 7)
 */
export {
  SAFETY_RULES,
  validateDataIntegrity,
  meetsConfidenceThreshold,
  sanitizeContactEmail,
  buildDataIntegrityMeta,
} from "./data_integrity";
export type { DataIntegrityMeta, SafetyRuleKey } from "./data_integrity";
