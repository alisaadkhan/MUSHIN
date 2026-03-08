// Bot Analysis — on-demand fraud signal computation
// IMPORTANT: This sub-module must NEVER be called automatically on page load.
// It is triggered exclusively by the user clicking the "Enrich" button.
// The detect-bot-entendre edge function is expensive (~2–4 s) and rate-limited.
export { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
