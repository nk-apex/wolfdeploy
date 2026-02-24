import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Rocket, Eye, EyeOff, AlertCircle, CheckCircle2, ChevronDown, Globe } from "lucide-react";

const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", currency: "GHS", symbol: "₵", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", flag: "🇿🇦" },
  { code: "RW", name: "Rwanda", currency: "RWF", symbol: "FRw", flag: "🇷🇼" },
  { code: "TZ", name: "Tanzania", currency: "TZS", symbol: "TSh", flag: "🇹🇿" },
  { code: "UG", name: "Uganda", currency: "UGX", symbol: "USh", flag: "🇺🇬" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", symbol: "CFA", flag: "🇨🇮" },
  { code: "CM", name: "Cameroon", currency: "XAF", symbol: "FCFA", flag: "🇨🇲" },
  { code: "ZM", name: "Zambia", currency: "ZMW", symbol: "ZK", flag: "🇿🇲" },
  { code: "EG", name: "Egypt", currency: "EGP", symbol: "E£", flag: "🇪🇬" },
  { code: "ET", name: "Ethiopia", currency: "ETB", symbol: "Br", flag: "🇪🇹" },
  { code: "SN", name: "Senegal", currency: "XOF", symbol: "CFA", flag: "🇸🇳" },
  { code: "XX", name: "Others (USD)", currency: "USD", symbol: "$", flag: "🌐" },
];

export default function Signup() {
  const { signUp, user } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user && success) {
      const t = setTimeout(() => navigate("/dashboard"), 1200);
      return () => clearTimeout(t);
    }
  }, [user, success, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password, name, country.code);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
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
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }}
              >
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-mono font-bold text-white text-base mb-2">You're in!</h3>
              <p className="text-[11px] text-gray-500 font-mono mb-3 leading-relaxed">
                Account created for:
              </p>
              <div
                className="px-3 py-2 rounded-lg mb-4 text-[12px] font-mono font-bold text-primary break-all"
                style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
              >
                {email}
              </div>
              <p className="text-[10px] text-gray-600 font-mono leading-relaxed">
                Taking you to your dashboard...
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

              {/* Country */}
              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-mono font-bold mb-2 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Country / Currency
                </label>
                <div className="relative">
                  <button
                    data-testid="button-country-signup"
                    type="button"
                    onClick={() => setShowDrop(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-mono text-white transition-all"
                    style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    <span className="flex items-center gap-2">
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(74,222,128,0.1)", color: "hsl(142 76% 42%)" }}>
                        {country.currency}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform text-primary ${showDrop ? "rotate-180" : ""}`} />
                  </button>

                  {showDrop && (
                    <div
                      className="absolute top-full mt-1 left-0 right-0 rounded-xl overflow-hidden overflow-y-auto"
                      style={{
                        background: "#0a0a0a",
                        border: "1px solid rgba(74,222,128,0.2)",
                        maxHeight: "200px",
                        zIndex: 9999,
                      }}
                    >
                      {COUNTRIES.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          data-testid={`option-signup-country-${c.code}`}
                          onClick={() => { setCountry(c); setShowDrop(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-all"
                        >
                          <span>{c.flag}</span>
                          <span className="font-mono text-xs text-white flex-1">{c.name}</span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: "hsl(142 76% 42%)" }}>{c.currency}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
