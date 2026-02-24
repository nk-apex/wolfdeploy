import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, country?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  updateUserCountry: (countryCode: string) => Promise<void>;
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

      const { data } = sb.auth.onAuthStateChange((event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        setLoading(false);

        // Register user on sign-in or session restore — stores email, name, country for admin dashboard
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && sess?.user?.id) {
          const u = sess.user;
          fetch("/api/auth/register-ip", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": u.id },
            body: JSON.stringify({
              userId: u.id,
              email: u.email,
              displayName: u.user_metadata?.full_name || u.user_metadata?.name || null,
              country: u.user_metadata?.country || null,
            }),
          }).catch(() => {});
        }
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

  const signUp = async (email: string, password: string, name: string, country?: string) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, country: country ?? "NG" }),
      });
      const data = await res.json() as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        return { error: data.error ?? "Signup failed. Please try again." };
      }
      // Auto sign-in immediately — no email confirmation needed
      const sb = await getSupabase();
      const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
      if (signInErr) {
        return { error: null }; // Account created, just redirect to login
      }
      return { error: null };
    } catch {
      return { error: "Could not connect. Please try again." };
    }
  };

  const updateUserCountry = async (countryCode: string) => {
    const sb = await getSupabase();
    await sb.auth.updateUser({ data: { country: countryCode } });
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
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resendConfirmation, updateUserCountry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
