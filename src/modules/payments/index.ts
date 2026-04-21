/**
 * Payments Module — public barrel
 *
 * Handles subscription management, credit system, billing flows,
 * and compliance checks.
 *
 * Credit model:
 *   - Search:     1 credit per request
 *   - Enrichment: 5–10 credits per creator (deep analytics via Apify / YouTube data)
 *   - AI Insights: ai_credits_remaining tracked separately
 *
 * Components are imported directly:
 *   import { CompliancePanel } from "@/components/payments/CompliancePanel"
 *   import { PaymentsPanel } from "@/components/payments/PaymentsPanel"
 *
 * This barrel exports shared hooks only.
 */
export { useSubscription } from "@/hooks/useSubscription";
export { usePlanLimits } from "@/hooks/usePlanLimits";
export { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
