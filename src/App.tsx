import { useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import SearchPage from "./pages/SearchPage";
import ListsPage from "./pages/ListsPage";
import ListDetailPage from "./pages/ListDetailPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignComparePage from "./pages/CampaignComparePage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import SavedSearchesPage from "./pages/SavedSearchesPage";
import HistoryPage from "./pages/HistoryPage";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import BillingPage from "./pages/BillingPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AboutPage from "./pages/AboutPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import CookiePolicyPage from "./pages/CookiePolicyPage";
import BlogPage from "./pages/BlogPage";
import InfluencerProfilePage from "./pages/InfluencerProfilePage";
import NotFound from "./pages/NotFound";
import { AdminRoute } from "@/components/admin/AdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminContent from "./pages/admin/AdminContent";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminConfig from "./pages/admin/AdminConfig";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminPermissions from "./pages/admin/AdminPermissions";

import AdminSupportTickets from "./pages/admin/AdminSupportTickets";
import SupportPage from "./pages/SupportPage";

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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
  );
};

export default App;
