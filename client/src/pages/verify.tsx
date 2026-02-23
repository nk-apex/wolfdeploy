import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getSupabase } from "@/lib/supabase";
import { useTheme, getThemeTokens } from "@/lib/theme";
import wolfLogoPath from "@assets/wolftech_1771881436325.jpeg";

type State = "idle" | "verifying" | "success" | "error";

export default function VerifyPage() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function handleVerify() {
    setState("verifying");
    try {
      const sb = await getSupabase();

      // Supabase puts tokens in the URL hash after email redirect
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (accessToken && refreshToken) {
        const { error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        setState("success");
        setMessage(type === "recovery" ? "Password reset ready." : "Email verified successfully!");
        setTimeout(() => navigate("/"), 2000);
      } else {
        // Try getSession in case Supabase already handled it
        const { data } = await sb.auth.getSession();
        if (data.session) {
          setState("success");
          setMessage("You're already verified!");
          setTimeout(() => navigate("/"), 1500);
        } else {
          throw new Error("No verification token found. Make sure you opened this link directly from the email.");
        }
      }
    } catch (err: any) {
      setState("error");
      setMessage(err.message || "Verification failed. Try clicking the link in your email again.");
    }
  }

  // Auto-verify on page load if tokens are in the hash
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      handleVerify();
    }
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: t.bg }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${t.gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${t.gridColor} 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src={wolfLogoPath}
            alt="WolfDeploy"
            className="w-20 h-20 rounded-2xl object-cover"
            style={{ border: `2px solid ${t.accentFaded(0.3)}`, boxShadow: `0 0 32px ${t.accentFaded(0.15)}` }}
          />
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${t.accentFaded(0.12)}`,
            backdropFilter: "blur(12px)",
          }}
        >
          {state === "idle" && (
            <>
              <h1 className="text-xl font-bold mb-2" style={{ color: t.accent }}>Verify Your Email</h1>
              <p className="text-sm text-gray-500 mb-6">Click the button below to confirm your email address and activate your WolfDeploy account.</p>
              <button
                data-testid="button-verify"
                onClick={handleVerify}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${t.accentFaded(0.9)}, ${t.accentFaded(0.7)})`,
                  color: "#000",
                  boxShadow: `0 4px 20px ${t.accentFaded(0.25)}`,
                }}
              >
                Verify My Account
              </button>
            </>
          )}

          {state === "verifying" && (
            <>
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
                style={{ borderColor: `${t.accent} transparent transparent transparent` }}
              />
              <h1 className="text-lg font-bold mb-1" style={{ color: t.accent }}>Verifying…</h1>
              <p className="text-sm text-gray-500">Please wait a moment.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
                style={{ background: t.accentFaded(0.12), border: `1px solid ${t.accentFaded(0.3)}` }}
              >
                ✓
              </div>
              <h1 className="text-lg font-bold mb-1" style={{ color: t.accent }}>Verified!</h1>
              <p className="text-sm text-gray-500">{message}</p>
              <p className="text-xs text-gray-600 mt-2">Redirecting you to the dashboard…</p>
            </>
          )}

          {state === "error" && (
            <>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl bg-red-500/10 border border-red-500/30">
                ✕
              </div>
              <h1 className="text-lg font-bold mb-1 text-red-400">Verification Failed</h1>
              <p className="text-sm text-gray-500 mb-5">{message}</p>
              <button
                data-testid="button-retry-verify"
                onClick={() => { setState("idle"); setMessage(""); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={{ borderColor: t.accentFaded(0.2), color: t.accent }}
              >
                Try Again
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-gray-700 mt-4">
          WolfDeploy · deploy.xwolf.space
        </p>
      </div>
    </div>
  );
}
