import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, resetPostHog, trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

interface Workspace {
  workspace_id: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  workspace: Workspace | null;
  loading: boolean;
  profileError: boolean;
  needsEmailVerification: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const needsEmailVerification = !!user && !user.email_confirmed_at;

  const fetchProfileAndWorkspace = useCallback(async (userId: string) => {
    try {
      const [profileRes, workspaceRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.rpc("get_user_workspace"),
      ]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (workspaceRes.data && Array.isArray(workspaceRes.data) && workspaceRes.data.length > 0) {
        setWorkspace(workspaceRes.data[0] as Workspace);
      } else if (workspaceRes.data && !Array.isArray(workspaceRes.data)) {
        setWorkspace(workspaceRes.data as unknown as Workspace);
      }
      setProfileError(false);
    } catch {
      setProfileError(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      setProfileError(false);
      await fetchProfileAndWorkspace(user.id);
    }
  }, [user, fetchProfileAndWorkspace]);

  useEffect(() => {
    let lastTokenRefreshAt = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setWorkspace(null);
          setLoading(false);
          return;
        }

        // Block consumer email domains for Google OAuth sign-in.
        if (event === 'SIGNED_IN' && newSession) {
          const provider = newSession.user.app_metadata?.provider;
          if (provider === 'google') {
            const email = newSession.user.email || '';
            // Type assertion since the RPC may not be in generated types yet
            const { data: checkResult } = await (supabase.rpc as any)('check_email_allowed', { p_email: email });
            const result = checkResult as { allowed?: boolean } | null;
            if (result && result.allowed === false) {
              await supabase.auth.signOut();
              localStorage.setItem('auth_google_blocked', email.split('@')[1] || 'consumer');
              setSession(null); setUser(null); setProfile(null); setWorkspace(null);
              setLoading(false);
              return;
            }
          }
        }

        // Deduplicate rapid TOKEN_REFRESHED events (guard against duplicate fires within 2s)
        if (event === 'TOKEN_REFRESHED') {
          const now = Date.now();
          if (now - lastTokenRefreshAt < 2000) return;
          lastTokenRefreshAt = now;
        }

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          if (newSession.user.id) {
            identifyUser(newSession.user.id, {
              email: newSession.user.email,
              email_confirmed: !!newSession.user.email_confirmed_at,
            });
          }
          if (newSession.user.email_confirmed_at) {
            setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
          }
          trackEvent("login", { method: newSession.user.app_metadata?.provider || "email" });
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfileAndWorkspace]);

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (!error) {
      trackEvent("signup", { email_domain: email.split("@")[1] });
      logger.info("auth", "User signed up", { email });
    }
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (!error) {
      trackEvent("login", { method: "email" });
      logger.info("auth", "User signed in", { email });
    }
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithGoogle = async () => {
    trackEvent("login", { method: "google" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    trackEvent("logout");
    await supabase.auth.signOut();
    resetPostHog();
    setProfile(null);
    setWorkspace(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? new Error(error.message) : null };
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error ? new Error(error.message) : null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        workspace,
        loading,
        profileError,
        needsEmailVerification,
        refreshProfile,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
