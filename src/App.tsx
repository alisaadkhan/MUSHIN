import React, { useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SupportRoute } from "@/components/auth/SupportRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { usePostHogPageview } from "@/lib/analytics";

// Eagerly load the two routes users land on most — zero extra network round-trip
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import StaffLogin from "./pages/StaffLogin";

// All other routes are lazy-loaded so they don't inflate the initial JS bundle
const Index                = lazy(() => import("./pages/Index"));
const SearchPage           = lazy(() => import("./pages/SearchPage"));
const ListsPage            = lazy(() => import("./pages/ListsPage"));
const ListDetailPage       = lazy(() => import("./pages/ListDetailPage"));
const CampaignsPage        = lazy(() => import("./pages/CampaignsPage"));
const CampaignComparePage  = lazy(() => import("./pages/CampaignComparePage"));
const CampaignDetailPage   = lazy(() => import("./pages/CampaignDetailPage"));
const SavedSearchesPage    = lazy(() => import("./pages/SavedSearchesPage"));
const HistoryPage          = lazy(() => import("./pages/HistoryPage"));
const UpdatePassword       = lazy(() => import("./pages/UpdatePassword"));
const Onboarding           = lazy(() => import("./pages/Onboarding"));
const Settings             = lazy(() => import("./pages/Settings"));
const CreditsPage          = lazy(() => import("./pages/CreditsPage"));
const BillingPage          = lazy(() => import("./pages/BillingPage"));
const AnalyticsPage        = lazy(() => import("./pages/AnalyticsPage"));
const AboutPage            = lazy(() => import("./pages/AboutPage"));
const PrivacyPage          = lazy(() => import("./pages/PrivacyPage"));
const TermsPage            = lazy(() => import("./pages/TermsPage"));
const CookiePolicyPage     = lazy(() => import("./pages/CookiePolicyPage"));
const RefundPolicyPage     = lazy(() => import("./pages/RefundPolicyPage"));
const PricingPage          = lazy(() => import("./pages/PricingPage"));
const SaaSSubscriptionPage = lazy(() => import('./pages/SaaSSubscriptionPage'));
const EulaPage             = lazy(() => import('./pages/EulaPage'));
const DpaPage              = lazy(() => import('./pages/DpaPage'));
const SlaPage              = lazy(() => import('./pages/SlaPage'));
const AupPage              = lazy(() => import('./pages/AupPage'));
const NdaPage              = lazy(() => import('./pages/NdaPage'));
const MsaPage              = lazy(() => import('./pages/MsaPage'));
const BlogPage             = lazy(() => import("./pages/BlogPage"));
const InfluencerProfilePage = lazy(() => import("./pages/InfluencerProfilePage"));
const NotificationsPage     = lazy(() => import("./pages/NotificationsPage"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const ServerError          = lazy(() => import("./pages/ServerError"));
const SupportDashboard  = lazy(() => import("./pages/SupportDashboard"));
const SupportPage       = lazy(() => import("./pages/SupportPage"));
const SupportActivity   = lazy(() => import("./pages/SupportActivity"));
const SupportDiagnostics = lazy(() => import("./pages/SupportDiagnostics"));

// Admin pages — heavy, rarely accessed, loaded on demand
const AdminDashboard       = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers           = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetail      = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminStaff           = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSubscriptions   = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAnalytics       = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminConfig          = lazy(() => import("./pages/admin/AdminConfig"));
const AdminAuditLog        = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminAnnouncements   = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminPermissions     = lazy(() => import("./pages/admin/AdminPermissions"));
const AdminSupportTickets  = lazy(() => import("./pages/admin/AdminSupportTickets"));
const AdminCredits         = lazy(() => import("./pages/admin/AdminCredits"));
const AdminSecurity        = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminRevenue         = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminRbacGovernance  = lazy(() => import("./pages/admin/AdminRbacGovernance"));
const AdminSystemSettings  = lazy(() => import("./pages/admin/AdminSystemSettings"));
const AdminApiKeys         = lazy(() => import("./pages/admin/AdminApiKeys"));
const AdminSecurityFlags   = lazy(() => import("./pages/admin/AdminSecurityFlags"));
const AdminSupportActivity = lazy(() => import("./pages/admin/AdminSupportActivity"));
const AdminImpersonation   = lazy(() => import("./pages/admin/AdminImpersonation"));

// Fallback while a lazy chunk loads — flat background, no flash of empty chrome
const PageShell = () => (
  <div
    className="flex min-h-screen flex-col items-center justify-center gap-3"
    style={{ background: "#0c0c0c", color: "rgba(255,255,255,0.55)" }}
    aria-busy="true"
    aria-live="polite"
  >
    <div
      className="h-9 w-9 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin"
      style={{ animationDuration: "0.85s" }}
    />
    <p className="text-sm" style={{ lineHeight: 1.5 }}>
      Loading page…
    </p>
  </div>
);

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const PostHogPageviewTracker = () => {
  usePostHogPageview();
  return null;
};

const App = () => {
  // Stable client — recreated only on component mount, never on re-render.
  // Prevents cache miss storms caused by constructing a new QueryClient every render.
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 2,
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClientRef.current}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PostHogPageviewTracker />
          <AuthProvider>
            <AppErrorBoundary>
              <Suspense fallback={<PageShell />}>
                <Routes>
                  <Route path="/login" element={<Auth />} />
                  <Route path="/signup" element={<Auth />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<Auth />} />
                  <Route path="/admin/login" element={<StaffLogin />} />
                  <Route path="/support/login" element={<StaffLogin />} />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/dashboard" element={<ProtectedPage><Index /></ProtectedPage>} />
                  <Route path="/search" element={<ProtectedPage><SearchPage /></ProtectedPage>} />
                  <Route path="/lists" element={<ProtectedPage><ListsPage /></ProtectedPage>} />
                  <Route path="/lists/:id" element={<ProtectedPage><ListDetailPage /></ProtectedPage>} />
                  <Route path="/campaigns" element={<ProtectedPage><CampaignsPage /></ProtectedPage>} />
                  <Route path="/campaigns/compare" element={<ProtectedPage><CampaignComparePage /></ProtectedPage>} />
                  <Route path="/campaigns/:id" element={<ProtectedPage><CampaignDetailPage /></ProtectedPage>} />
                  <Route path="/saved-searches" element={<ProtectedPage><SavedSearchesPage /></ProtectedPage>} />
                  <Route path="/history" element={<ProtectedPage><HistoryPage /></ProtectedPage>} />
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
                  <Route path="/credits" element={<ProtectedPage><CreditsPage /></ProtectedPage>} />
                  <Route path="/billing" element={<ProtectedPage><BillingPage /></ProtectedPage>} />
                  <Route path="/analytics" element={<ProtectedPage><AnalyticsPage /></ProtectedPage>} />
                  <Route path="/notifications" element={<ProtectedPage><NotificationsPage /></ProtectedPage>} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/cookies" element={<CookiePolicyPage />} />
                  <Route path="/refunds" element={<RefundPolicyPage />} />
                  <Route path="/subscription" element={<SaaSSubscriptionPage />} />
                  <Route path="/eula" element={<EulaPage />} />
                  <Route path="/dpa" element={<DpaPage />} />
                  <Route path="/sla" element={<SlaPage />} />
                  <Route path="/aup" element={<AupPage />} />
                  <Route path="/nda" element={<NdaPage />} />
                  <Route path="/msa" element={<MsaPage />} />
                  <Route path="/influencer/:platform/:username" element={<ProtectedPage><InfluencerProfilePage /></ProtectedPage>} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/500" element={<ServerError />} />
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute requiredPermission="canManageUsers"><AdminUsers /></AdminRoute>} />
                  <Route path="/admin/users/:id" element={<AdminRoute requiredPermission="canManageUsers"><AdminUserDetail /></AdminRoute>} />
                  <Route path="/admin/staff" element={<AdminRoute requiredPermission="canManageUsers"><AdminStaff /></AdminRoute>} />
                  <Route path="/admin/subscriptions" element={<AdminRoute requiredPermission="canManageUsers"><AdminSubscriptions /></AdminRoute>} />
                  <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                  <Route path="/admin/revenue" element={<AdminRoute><AdminRevenue /></AdminRoute>} />
                  <Route path="/admin/config" element={<AdminRoute requiredPermission="canEditConfig"><AdminConfig /></AdminRoute>} />
                  <Route path="/admin/audit-log" element={<AdminRoute requiredPermission="canViewAuditLog"><AdminAuditLog /></AdminRoute>} />
                  <Route path="/admin/security" element={<AdminRoute requiredPermission="canViewAuditLog"><AdminSecurity /></AdminRoute>} />
                  <Route path="/admin/security/flags" element={<AdminRoute requiredPermission="canEditConfig"><AdminSecurityFlags /></AdminRoute>} />
                  <Route path="/admin/security/support-activity" element={<AdminRoute requiredPermission="canEditConfig"><AdminSupportActivity /></AdminRoute>} />
                  <Route path="/admin/announcements" element={<AdminRoute requiredPermission="canManageAnnouncements"><AdminAnnouncements /></AdminRoute>} />
                  <Route path="/admin/permissions" element={<AdminRoute requiredPermission="canEditConfig"><AdminPermissions /></AdminRoute>} />
                  <Route path="/admin/rbac" element={<AdminRoute requiredPermission="canEditConfig"><AdminRbacGovernance /></AdminRoute>} />
                  <Route path="/admin/system-settings" element={<AdminRoute requiredPermission="canEditConfig"><AdminSystemSettings /></AdminRoute>} />
                  <Route path="/admin/api-keys" element={<AdminRoute requiredPermission="canEditConfig"><AdminApiKeys /></AdminRoute>} />
                  <Route path="/admin/impersonation" element={<AdminRoute requiredPermission="canEditConfig"><AdminImpersonation /></AdminRoute>} />
                  <Route path="/support/dashboard" element={<SupportRoute><SupportDashboard /></SupportRoute>} />
                  <Route path="/support/activity" element={<SupportRoute><SupportActivity /></SupportRoute>} />
                  <Route path="/support/diagnostics" element={<SupportRoute><SupportDiagnostics /></SupportRoute>} />
                  <Route path="/support" element={<ProtectedPage><SupportPage /></ProtectedPage>} />
                  <Route path="/admin/support" element={<AdminRoute requiredPermission="canManageUsers"><AdminSupportTickets /></AdminRoute>} />
                  <Route path="/admin/credits" element={<AdminRoute requiredPermission="canManageUsers"><AdminCredits /></AdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
  );
};

export default App;
