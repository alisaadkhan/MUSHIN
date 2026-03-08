import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Consumer email domains blocked from Google OAuth (business-only platform)
// This is a client-side UX guard; server-side enforcement is recommended via Supabase Auth hooks.
const CONSUMER_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com',
  'icloud.com','aol.com','protonmail.com','ymail.com','googlemail.com','yahoo.co.uk',
  'yahoo.in','yahoo.com.pk','hotmail.co.uk','msn.com','me.com','mail.com','gmx.com',
]);

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

        // Block consumer email domains for Google OAuth sign-in
        if (event === 'SIGNED_IN' && newSession) {
          const provider = newSession.user.app_metadata?.provider;
          if (provider === 'google') {
            const email = newSession.user.email || '';
            const domain = email.split('@')[1]?.toLowerCase() || '';
            if (CONSUMER_DOMAINS.has(domain)) {
              await supabase.auth.signOut();
              localStorage.setItem('auth_google_blocked', domain);
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
          if (newSession.user.email_confirmed_at) {
            setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
          }
        }
        setLoading(false);
      }
    );

    // M-5 fix: onAuthStateChange fires INITIAL_SESSION immediately with the
    // current session — no need to call getSession() separately which causes a
    // duplicate fetchProfileAndWorkspace on every app load.
    // setLoading(false) is already handled inside the listener for all paths.

    return () => subscription.unsubscribe();
  }, [fetchProfileAndWorkspace]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
