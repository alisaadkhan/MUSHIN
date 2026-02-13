import { useSubscription } from "./useSubscription";
import { useWorkspaceCredits } from "./useWorkspaceCredits";
import { useCampaigns } from "./useCampaigns";

export function usePlanLimits() {
  const { planConfig, plan } = useSubscription();
  const { data: credits } = useWorkspaceCredits();
  const { data: campaigns } = useCampaigns();

  const canCreateCampaign = () => {
    if (planConfig.campaigns === Infinity) return true;
    return (campaigns?.length ?? 0) < planConfig.campaigns;
  };

  const canSendEmail = () => {
    return (credits?.email_sends_remaining ?? 0) > 0;
  };

  const canUseAI = () => {
    if (planConfig.ai_credits === Infinity) return true;
    return (credits?.ai_credits_remaining ?? 0) > 0;
  };

  const campaignLimit = planConfig.campaigns === Infinity ? "Unlimited" : planConfig.campaigns;
  const emailsRemaining = credits?.email_sends_remaining ?? planConfig.email_sends;
  const aiRemaining = credits?.ai_credits_remaining ?? planConfig.ai_credits;

  return {
    plan,
    planConfig,
    canCreateCampaign,
    canSendEmail,
    canUseAI,
    campaignLimit,
    emailsRemaining,
    aiRemaining,
  };
}
