import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Rocket, Eye, EyeOff, AlertCircle, Mail, CheckCircle2, Clock } from "lucide-react";

const RESEND_COOLDOWN = 60;

export default function Login() {
  const [, navigate] = useLocation();
  const { signIn, resendConfirmation } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      if (err.toLowerCase().includes("email not confirmed") || err.toLowerCase().includes("not confirmed")) {
        setNeedsConfirm(true);
      } else {
        setError(err);
      }
      return;
    }
    navigate("/");
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setError(null);
    const { error: err } = await resendConfirmation(email);
    setResendLoading(false);
    if (!err) {
      setResendSent(true);
      startCooldown();
    } else {
      const isRateLimit = err.toLowerCase().includes("rate") || err.toLowerCase().includes("too many") || err.toLowerCase().includes("limit");
      setError(isRateLimit
        ? "Email sending limit reached. Please wait a few minutes before requesting another confirmation email."
        : err
      );
      startCooldown();
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#080808" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(74,222,128,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "hsl(142 76% 42%)" }}
              >
                W
              </div>
              <span className="font-black tracking-widest text-primary text-base uppercase">WolfDeploy</span>
            </div>
          </Link>
          <p className="text-xs text-gray-600 font-mono mt-2">Sign in to your account</p>
        </div>

        {/* Card */}
        <div
          className="p-6 sm:p-8 rounded-2xl"
          style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}
        >
          {/* Email confirmation required banner */}
          {needsConfirm && (
            <div
              className="mb-5 p-4 rounded-xl"
              style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.25)" }}
            >
              <div className="flex items-start gap-2.5 mb-3">
                <Mail className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-yellow-400 font-mono font-bold mb-1">Confirm your email first</p>
                  <p className="text-[10px] text-yellow-600 font-mono leading-relaxed">
                    We sent a confirmation link to <span className="text-yellow-400 font-bold">{email}</span>. Click it to activate your account, then sign in.
                  </p>
                </div>
              </div>
              {resendSent && resendCooldown === 0 ? (
                <div className="flex items-center gap-1.5 text-[10px] text-primary font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmation email resent! Check your inbox.
                </div>
              ) : (
                <button
                  data-testid="button-resend-confirmation"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                  className="flex items-center gap-1.5 text-[10px] text-yellow-500 font-mono hover:text-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <div className="w-3 h-3 rounded-full border border-yellow-500/30 border-t-yellow-500 animate-spin" />
                  ) : resendCooldown > 0 ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    <Mail className="w-3 h-3" />
                  )}
                  {resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : resendSent
                    ? "Resend again"
                    : "Resend confirmation email"
                  }
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-mono font-bold mb-2">
                Email
              </label>
              <input
                data-testid="input-email"
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setNeedsConfirm(false); setResendSent(false); }}
                placeholder="wolf@example.com"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white placeholder:text-gray-700 outline-none transition-all"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-mono font-bold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  data-testid="input-password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm font-mono text-white placeholder:text-gray-700 outline-none transition-all"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Generic error */}
            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-mono text-red-400"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              data-testid="button-login"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-[11px] text-gray-600 font-mono">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create one free
          </Link>
        </p>
        <p className="text-center mt-2 text-[11px] text-gray-600 font-mono">
          <Link href="/" className="hover:text-gray-400 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
