import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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
  needsEmailVerification: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

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
    } catch {
      // Profile/workspace fetch failed – app still works
    }
  }, []);

  useEffect(() => {
    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user && newSession.user.email_confirmed_at) {
          // Defer to avoid Supabase client deadlock
          setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
        } else {
          setProfile(null);
          setWorkspace(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user && initialSession.user.email_confirmed_at) {
        fetchProfileAndWorkspace(initialSession.user.id);
      }
      setLoading(false);
    });

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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    return { error: result.error ? (result.error instanceof Error ? result.error : new Error(String(result.error))) : null };
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
        needsEmailVerification,
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
