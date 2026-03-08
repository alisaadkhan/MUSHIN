/**
 * src/modules/future-ai/index.ts
 *
 * Future AI Modules — Architecture Placeholders (Phase 7)
 *
 * These modules are reserved for future phases. No implementation exists yet.
 * Architecture is scaffolded to allow planning and interface design.
 *
 * ❌ DO NOT call any function in this file in production code.
 * ✅ Use these identifiers for roadmap planning and interface drafting only.
 */

// ---------------------------------------------------------------------------
// Module registry — reserved future AI capabilities
// ---------------------------------------------------------------------------

export const FUTURE_AI_MODULES = {
  /** Phase 8: RL-based search ranking personalization */
  REINFORCEMENT_LEARNING_RANKING: "reinforcement_learning_ranking",
  /** Phase 8: Automated campaign bidding optimizer */
  CAMPAIGN_AUTOBIDDING_OPTIMIZER: "campaign_autobidding_optimizer",
  /** Phase 9: Autonomous creator enrichment scheduler */
  AUTONOMOUS_ENRICHMENT_SCHEDULER: "autonomous_enrichment_scheduler",
} as const;

export type FutureAIModuleKey = keyof typeof FUTURE_AI_MODULES;

// ---------------------------------------------------------------------------
// Placeholder interfaces — define shape before implementation
// ---------------------------------------------------------------------------

/** Future input for RL-based ranking personalization */
export interface RLRankingInput {
  sessionId: string;
  userId: string;
  searchQuery: string;
  clickedResultIds: string[];
  dwellTimeMs: number[];
}

/** Future output for RL-based ranking */
export interface RLRankingOutput {
  rerankedResultIds: string[];
  personalizationScore: number;
  modelVersion: string;
}

/** Future input for campaign auto-bidding */
export interface AutobiddingInput {
  campaignBudgetPkr: number;
  targetNiche: string;
  targetFollowerTier: "nano" | "micro" | "mid" | "macro" | "mega";
  durationDays: number;
}

/** Future output for campaign auto-bidding */
export interface AutobiddingOutput {
  recommendedCreatorCount: number;
  estimatedBudgetPerCreator: number;
  expectedReach: number;
  confidence: number;
}

/** Future input for autonomous enrichment scheduling */
export interface EnrichmentSchedulerInput {
  creatorIds: string[];
  prioritySignals: Record<string, number>;
  budgetCredits: number;
}

// ---------------------------------------------------------------------------
// Stub functions — throw with clear "not implemented" message
// ---------------------------------------------------------------------------

/**
 * @throws Not yet implemented — scheduled for Phase 8.
 */
export function reinforcementLearningRanking(_input: RLRankingInput): never {
  throw new Error(
    "reinforcementLearningRanking: Not yet implemented. Scheduled for Phase 8.",
  );
}

/**
 * @throws Not yet implemented — scheduled for Phase 8.
 */
export function campaignAutobiddingOptimizer(_input: AutobiddingInput): never {
  throw new Error(
    "campaignAutobiddingOptimizer: Not yet implemented. Scheduled for Phase 8.",
  );
}

/**
 * @throws Not yet implemented — scheduled for Phase 9.
 */
export function autonomousEnrichmentScheduler(_input: EnrichmentSchedulerInput): never {
  throw new Error(
    "autonomousEnrichmentScheduler: Not yet implemented. Scheduled for Phase 9.",
  );
}
