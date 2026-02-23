import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Rocket, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Signup() {
  const [, navigate] = useLocation();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password, name);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
    setTimeout(() => navigate("/"), 2500);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#080808" }}
    >
      {/* Grid bg */}
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
          <p className="text-xs text-gray-600 font-mono mt-2">Create your free account</p>
        </div>

        {/* Card */}
        <div
          className="p-6 sm:p-8 rounded-2xl"
          style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}
        >
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-display font-bold text-white mb-2">Account created!</h3>
              <p className="text-xs text-gray-400 font-mono">
                Check your email to confirm your account, then you'll be redirected to the dashboard.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-mono font-bold mb-2">
                  Full Name
                </label>
                <input
                  data-testid="input-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Wolf"
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white placeholder:text-gray-700 outline-none transition-all"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                />
              </div>

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
                  onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="Min. 6 characters"
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

              {/* Error */}
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
                data-testid="button-signup"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-mono font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Create Free Account
                  </>
                )}
              </button>

              <p className="text-[10px] text-gray-700 font-mono text-center">
                By signing up you agree to our Terms of Service.
              </p>
            </form>
          )}
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-[11px] text-gray-600 font-mono">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center mt-2 text-[11px] text-gray-600 font-mono">
          <Link href="/" className="hover:text-gray-400 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
