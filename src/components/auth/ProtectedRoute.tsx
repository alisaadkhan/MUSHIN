import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, needsEmailVerification, profile, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow /update-password even if email not confirmed (recovery flow)
  if (needsEmailVerification && location.pathname !== "/update-password") {
    return <Navigate to="/auth?verify=required" replace />;
  }

  // Profile error – show retry card
  if (profileError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="glass-card p-8 text-center max-w-sm space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Failed to load profile</h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading your profile. Please try again.
          </p>
          <Button onClick={refreshProfile}>Retry</Button>
        </div>
      </div>
    );
  }

  // Profile still loading (user exists but profile not yet fetched)
  if (!needsEmailVerification && profile === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Onboarding gate
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
