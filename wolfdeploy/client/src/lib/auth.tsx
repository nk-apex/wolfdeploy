import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;

    getSupabase().then((sb) => {
      sb.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      });

      const { data } = sb.auth.onAuthStateChange((_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        setLoading(false);
      });
      sub = data.subscription;
    });

    return () => { sub?.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const sb = await getSupabase();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: redirectTo,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const sb = await getSupabase();
    await sb.auth.signOut();
  };

  const resendConfirmation = async (email: string) => {
    const sb = await getSupabase();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resendConfirmation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
