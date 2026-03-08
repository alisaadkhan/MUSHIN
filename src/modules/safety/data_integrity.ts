/**
 * src/modules/safety/data_integrity.ts
 *
 * Advanced Safety Rules — Data Integrity Layer
 *
 * Enforces Mushin's core safety rules:
 *   ❌ No fake demographic synthesis
 *   ❌ No fake engagement data
 *   ❌ No AI-hallucinated contact information
 *
 * Every analytics result MUST carry:
 *   - source_verified  : boolean — were all inputs non-null and from real profile data
 *   - confidence_score : number  — probability the output is reliable
 *   - data_origin      : string  — provenance of the computation
 *
 * Design invariants:
 *   - This module has NO side effects
 *   - All functions are pure and synchronous
 *   - Callers MUST check validateDataIntegrity() before rendering predictions
 */

// ---------------------------------------------------------------------------
// Safety rule constants
// ---------------------------------------------------------------------------

export const SAFETY_RULES = {
  /** Never synthesize demographic profiles from insufficient data */
  NO_FAKE_DEMOGRAPHICS: true,
  /** Never fabricate engagement metrics */
  NO_FAKE_ENGAGEMENT: true,
  /** Never generate or suggest contact info from AI inference */
  NO_AI_HALLUCINATED_CONTACT: true,
  /** Minimum confidence threshold for showing any analytics prediction */
  MIN_CONFIDENCE_THRESHOLD: 0.60,
  /** Minimum confidence for geographic location assertions */
  GEO_CONFIDENCE_THRESHOLD: 0.70,
  /** Minimum confidence for predictive intelligence display */
  PREDICTIVE_CONFIDENCE_THRESHOLD: 0.65,
} as const;

export type SafetyRuleKey = keyof typeof SAFETY_RULES;

// ---------------------------------------------------------------------------
// Data integrity metadata interface
// ---------------------------------------------------------------------------

export interface DataIntegrityMeta {
  /** Whether all required inputs were non-null, real profile signals */
  source_verified: boolean;
  /** Confidence in the computation [0, 1] */
  confidence_score: number;
  /** Human-readable provenance string */
  data_origin: string;
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validate that a result's data integrity metadata meets minimum safety standards.
 * Returns false if the result should NOT be rendered to the user.
 */
export function validateDataIntegrity(
  meta: DataIntegrityMeta,
  threshold = SAFETY_RULES.MIN_CONFIDENCE_THRESHOLD,
): boolean {
  if (!meta.source_verified) return false;
  if (meta.confidence_score < threshold) return false;
  if (!meta.data_origin || meta.data_origin.trim() === "") return false;
  return true;
}

/**
 * Assert that a confidence score meets the required threshold.
 * Use threshold=SAFETY_RULES.PREDICTIVE_CONFIDENCE_THRESHOLD for predictive panels.
 */
export function meetsConfidenceThreshold(
  confidence: number,
  threshold = SAFETY_RULES.MIN_CONFIDENCE_THRESHOLD,
): boolean {
  return confidence >= threshold;
}

/**
 * Sanitize a contact email string.
 * Returns null if the email is empty, null, undefined, or matches known
 * AI-generated placeholder patterns (e.g. "user@example.com").
 *
 * This prevents AI-hallucinated contact info from being displayed.
 */
export function sanitizeContactEmail(email: string | null | undefined): string | null {
  if (!email || email.trim() === "") return null;

  const lower = email.toLowerCase().trim();

  // Reject obvious placeholder / AI-generated patterns
  const PLACEHOLDER_PATTERNS = [
    /^user@example\.com$/,
    /^contact@example\.com$/,
    /^info@example\.com$/,
    /^admin@example\.com$/,
    /^noreply@/,
    /^no-reply@/,
    /example\.(com|net|org)$/,
    /test\.(com|net|org)$/,
    /placeholder/,
    /fake/,
  ];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(lower)) return null;
  }

  // Basic structural validation (must have @ and a TLD)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!EMAIL_RE.test(lower)) return null;

  return email.trim();
}

/**
 * Build a standard DataIntegrityMeta object for a computed result.
 */
export function buildDataIntegrityMeta(opts: {
  sourceVerified: boolean;
  confidenceScore: number;
  dataOrigin: string;
}): DataIntegrityMeta {
  return {
    source_verified: opts.sourceVerified,
    confidence_score: Math.max(0, Math.min(1, opts.confidenceScore)),
    data_origin: opts.dataOrigin,
  };
}
