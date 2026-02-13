import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/update-password" element={<ProtectedRoute><UpdatePassword /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedPage><Index /></ProtectedPage>} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
