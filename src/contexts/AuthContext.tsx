import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, resetPostHog, trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { consumePasswordAuthSlot } from "@/lib/authRateLimit";

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
  signUp: (
    email: string,
    password: string,
    opts?: {
      captchaToken?: string;
      termsAcceptedAt?: string;
      privacyAcceptedAt?: string;
    },
  ) => Promise<{ error: Error | null; session: Session | null }>;
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
  // Use a ref so the timeout fallback always sees the live value
  const loadingRef = useRef(true);

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
    loadingRef.current = false;
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      setProfileError(false);
      await fetchProfileAndWorkspace(user.id);
    }
  }, [user, fetchProfileAndWorkspace]);

  useEffect(() => {
    let lastTokenRefreshAt = 0;

    // Hydrate immediately — removes "wait a few seconds then it works" on first load
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        // If email confirmed, fetch profile; otherwise just stop the loading spinner
        if (data.session.user.email_confirmed_at) {
          fetchProfileAndWorkspace(data.session.user.id);
        } else {
          loadingRef.current = false;
          setLoading(false);
        }
      } else {
        loadingRef.current = false;
        setLoading(false);
      }
    }).catch(() => {
      loadingRef.current = false;
      setLoading(false);
    });

    // Hard timeout fallback — if getSession or fetchProfile never resolves, unblock the UI
    const fallbackTimer = setTimeout(() => {
      if (loadingRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setWorkspace(null);
          loadingRef.current = false;
          setLoading(false);
          return;
        }

        // Allow any email domain for Google OAuth sign-in.

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
          // Google OAuth: persist Terms / Privacy acceptance from signup flow (sessionStorage).
          if (event === "SIGNED_IN") {
            try {
              const raw = sessionStorage.getItem("oauth_legal");
              if (raw) {
                const j = JSON.parse(raw) as { terms?: string; privacy?: string };
                sessionStorage.removeItem("oauth_legal");
                if (j.terms && j.privacy) {
                  void supabase.auth.updateUser({
                    data: {
                      terms_accepted_at: j.terms,
                      privacy_accepted_at: j.privacy,
                    },
                  });
                }
              }
            } catch {
              sessionStorage.removeItem("oauth_legal");
            }
          }
          if (newSession.user.email_confirmed_at) {
            setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
          }
          trackEvent("login", { method: newSession.user.app_metadata?.provider || "email" });
        }
        loadingRef.current = false;
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [fetchProfileAndWorkspace]);

  const signUp = async (
    email: string,
    password: string,
    opts?: { captchaToken?: string; termsAcceptedAt?: string; privacyAcceptedAt?: string },
  ) => {
    const gate = await consumePasswordAuthSlot();
    if (!gate.ok) {
      logger.warn("auth", "Signup blocked by rate limit", {});
      return { error: new Error(gate.message), session: null };
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        ...(opts?.captchaToken ? { captchaToken: opts.captchaToken } : {}),
        data: {
          terms_accepted_at: opts?.termsAcceptedAt ?? now,
          privacy_accepted_at: opts?.privacyAcceptedAt ?? now,
        },
      },
    });
    if (!error && data.session) {
      trackEvent("signup", { email_domain: email.split("@")[1] });
      logger.info("auth", "User signed up", { email });
    } else if (!error) {
      trackEvent("signup", { email_domain: email.split("@")[1] });
      logger.info("auth", "User signed up (pending verification)", { email });
    }
    return {
      error: error ? new Error(error.message) : null,
      session: data.session ?? null,
    };
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const gate = await consumePasswordAuthSlot();
    if (!gate.ok) {
      logger.warn("auth", "Sign-in blocked by rate limit", {});
      return { error: new Error(gate.message) };
    }
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
