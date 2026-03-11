import React, { useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminRoute } from "@/components/admin/AdminRoute";

// Eagerly load the two routes users land on most — zero extra network round-trip
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";

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
const BillingPage          = lazy(() => import("./pages/BillingPage"));
const AnalyticsPage        = lazy(() => import("./pages/AnalyticsPage"));
const AboutPage            = lazy(() => import("./pages/AboutPage"));
const PrivacyPage          = lazy(() => import("./pages/PrivacyPage"));
const TermsPage            = lazy(() => import("./pages/TermsPage"));
const CookiePolicyPage     = lazy(() => import("./pages/CookiePolicyPage"));
const BlogPage             = lazy(() => import("./pages/BlogPage"));
const InfluencerProfilePage = lazy(() => import("./pages/InfluencerProfilePage"));
const NotFound             = lazy(() => import("./pages/NotFound"));
const SupportPage          = lazy(() => import("./pages/SupportPage"));

// Admin pages — heavy, rarely accessed, loaded on demand
const AdminDashboard       = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers           = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSubscriptions   = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminContent         = lazy(() => import("./pages/admin/AdminContent"));
const AdminAnalytics       = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminConfig          = lazy(() => import("./pages/admin/AdminConfig"));
const AdminAuditLog        = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminAnnouncements   = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminPermissions     = lazy(() => import("./pages/admin/AdminPermissions"));
const AdminSupportTickets  = lazy(() => import("./pages/admin/AdminSupportTickets"));
const AdminCredits         = lazy(() => import("./pages/admin/AdminCredits"));

// Minimal fallback shown while a lazy chunk is loading
const PageShell = () => (
  <div style={{ minHeight: "100vh", background: "#0a0114" }} aria-busy="true" />
);

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => {
  // Stable client — recreated only on component mount, never on re-render.
  // Prevents cache miss storms caused by constructing a new QueryClient every render.
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
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
          <AuthProvider>
            <AppErrorBoundary>
              <Suspense fallback={<PageShell />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/update-password" element={<ProtectedRoute><UpdatePassword /></ProtectedRoute>} />
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
                  <Route path="/billing" element={<ProtectedPage><BillingPage /></ProtectedPage>} />
                  <Route path="/analytics" element={<ProtectedPage><AnalyticsPage /></ProtectedPage>} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/cookies" element={<CookiePolicyPage />} />
                  <Route path="/influencer/:platform/:username" element={<ProtectedPage><InfluencerProfilePage /></ProtectedPage>} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute requiredPermission="canManageUsers"><AdminUsers /></AdminRoute>} />
                  <Route path="/admin/subscriptions" element={<AdminRoute requiredPermission="canManageUsers"><AdminSubscriptions /></AdminRoute>} />
                  <Route path="/admin/content" element={<AdminRoute requiredPermission="canModerateContent"><AdminContent /></AdminRoute>} />
                  <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                  <Route path="/admin/config" element={<AdminRoute requiredPermission="canEditConfig"><AdminConfig /></AdminRoute>} />
                  <Route path="/admin/audit-log" element={<AdminRoute requiredPermission="canViewAuditLog"><AdminAuditLog /></AdminRoute>} />
                  <Route path="/admin/announcements" element={<AdminRoute requiredPermission="canManageAnnouncements"><AdminAnnouncements /></AdminRoute>} />
                  <Route path="/admin/permissions" element={<AdminRoute requiredPermission="canEditConfig"><AdminPermissions /></AdminRoute>} />
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
