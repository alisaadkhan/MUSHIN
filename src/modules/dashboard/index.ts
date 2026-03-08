/**
 * Dashboard Module — public barrel
 *
 * Provides workspace summary widgets, stats, recent activity,
 * and ROI analytics for the authenticated user's home screen.
 *
 * Components are imported directly:
 *   import { DashboardStats } from "@/components/dashboard/DashboardStats"
 *   import { RecentActivity } from "@/components/dashboard/RecentActivity"
 *   import { ROITrendChart } from "@/components/dashboard/ROITrendChart"
 *   import { ActiveCampaignsTable } from "@/components/dashboard/ActiveCampaignsTable"
 *
 * This barrel is a placeholder for future shared dashboard hooks
 * (e.g. useDashboardSummary, useWorkspaceStats).
 */

// Re-export credit hook since the dashboard header always displays credit balance.
export { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
