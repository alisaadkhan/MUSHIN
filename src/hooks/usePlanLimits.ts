import { useSubscription } from "./useSubscription";
import { useWorkspaceCredits } from "./useWorkspaceCredits";
import { useCampaigns } from "./useCampaigns";

export function usePlanLimits() {
  const { planConfig, plan } = useSubscription();
  const { data: credits, isLoading: creditsLoading } = useWorkspaceCredits();
  const { data: campaigns } = useCampaigns();

  const isFree = plan === "free";

  const canCreateCampaign = () => {
    if (planConfig.campaigns === Infinity) return true;
    return (campaigns?.length ?? 0) < planConfig.campaigns;
  };

  const canSendEmail = () => {
    // Return true optimistically while credits are still loading to avoid
    // incorrectly blocking the UI before the first fetch completes.
    if (creditsLoading && !credits) return true;
    return (credits?.email_sends_remaining ?? 0) > 0;
  };

  const canUseAI = () => {
    if (planConfig.ai_credits === Infinity) return true;
    if (creditsLoading && !credits) return true;
    return (credits?.ai_credits_remaining ?? 0) > 0;
  };

  const canSearch = () => {
    if (creditsLoading && !credits) return true;
    return (credits?.search_credits_remaining ?? 0) > 0;
  };

  const campaignLimit = planConfig.campaigns === Infinity ? "Unlimited" : planConfig.campaigns;
  const emailsRemaining = credits?.email_sends_remaining ?? planConfig.email_sends;
  const aiRemaining = credits?.ai_credits_remaining ?? planConfig.ai_credits;

  return {
    plan,
    planConfig,
    isFree,
    canCreateCampaign,
    canSendEmail,
    canUseAI,
    canSearch,
    campaignLimit,
    emailsRemaining,
    aiRemaining,
  };
}
