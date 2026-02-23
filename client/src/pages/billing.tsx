import { useState, useEffect } from "react";
import { Wallet, CreditCard, Smartphone, Globe, Check, Crown, Shield, Zap, ChevronDown, Lock, X, ArrowRight, ShieldCheck, Banknote } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: { NGN: 7500, GHS: 85, ZAR: 90, KES: 640, RWF: 5500, TZS: 12500, UGX: 18000, XOF: 3000, XAF: 3000, ZMW: 130, EGP: 155, ETB: 275, USD: 5 },
    icon: Zap,
    features: ["1 Bot Instance", "512MB RAM", "Shared CPU", "Community Support", "Basic Logs"],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: { NGN: 22500, GHS: 250, ZAR: 270, KES: 1950, RWF: 16500, TZS: 37500, UGX: 54000, XOF: 9000, XAF: 9000, ZMW: 390, EGP: 465, ETB: 825, USD: 15 },
    icon: Shield,
    features: ["Unlimited Bots", "2GB RAM", "Dedicated CPU", "Priority Support", "Full Log Streaming", "Auto-Restart"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: { NGN: 73500, GHS: 820, ZAR: 880, KES: 6350, RWF: 54000, TZS: 122500, UGX: 176000, XOF: 29500, XAF: 29500, ZMW: 1280, EGP: 1520, ETB: 2700, USD: 49 },
    icon: Crown,
    features: ["Unlimited Bots", "8GB RAM", "Dedicated Server", "24/7 Priority Support", "Custom Domain", "SLA Guarantee"],
    highlight: false,
  },
];

const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦", flag: "🇳🇬", methods: ["card", "bank_transfer", "ussd"] },
  { code: "GH", name: "Ghana", currency: "GHS", symbol: "₵", flag: "🇬🇭", methods: ["card", "mobile_money"] },
  { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh", flag: "🇰🇪", methods: ["card", "mobile_money"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", flag: "🇿🇦", methods: ["card"] },
  { code: "RW", name: "Rwanda", currency: "RWF", symbol: "FRw", flag: "🇷🇼", methods: ["card", "mobile_money"] },
  { code: "TZ", name: "Tanzania", currency: "TZS", symbol: "TSh", flag: "🇹🇿", methods: ["card", "mobile_money"] },
  { code: "UG", name: "Uganda", currency: "UGX", symbol: "USh", flag: "🇺🇬", methods: ["card", "mobile_money"] },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", symbol: "CFA", flag: "🇨🇮", methods: ["card", "mobile_money"] },
  { code: "CM", name: "Cameroon", currency: "XAF", symbol: "FCFA", flag: "🇨🇲", methods: ["card", "mobile_money"] },
  { code: "ZM", name: "Zambia", currency: "ZMW", symbol: "ZK", flag: "🇿🇲", methods: ["card", "mobile_money"] },
  { code: "EG", name: "Egypt", currency: "EGP", symbol: "E£", flag: "🇪🇬", methods: ["card"] },
  { code: "ET", name: "Ethiopia", currency: "ETB", symbol: "Br", flag: "🇪🇹", methods: ["card"] },
  { code: "SN", name: "Senegal", currency: "XOF", symbol: "CFA", flag: "🇸🇳", methods: ["card", "mobile_money"] },
  { code: "XX", name: "Others (USD)", currency: "USD", symbol: "$", flag: "🌐", methods: ["card"] },
];

const METHOD_META: Record<string, { label: string; desc: string; icon: typeof CreditCard }> = {
  card:          { label: "Card",          desc: "Visa / Mastercard",       icon: CreditCard },
  mobile_money:  { label: "Mobile Money",  desc: "MTN, M-Pesa & more",      icon: Smartphone },
  bank_transfer: { label: "Bank Transfer", desc: "Direct bank transfer",    icon: Banknote },
  ussd:          { label: "USSD",          desc: "*737#, *919# & more",     icon: Smartphone },
};

declare global {
  interface Window {
    PaystackPop: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

function getInitialCountry(userId?: string, savedCode?: string) {
  const code = savedCode
    || (userId ? localStorage.getItem(`wolfdeploy_country_${userId}`) : null)
    || "NG";
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

/* ──────────────────────────────────────────────────────────
   Payment Modal
────────────────────────────────────────────────────────── */
interface PaymentModalProps {
  plan: typeof PLANS[0];
  country: typeof COUNTRIES[0];
  email: string;
  onClose: () => void;
  onPay: (method: string, email: string) => void;
  paying: boolean;
  t: ReturnType<typeof getThemeTokens>;
}

function PaymentModal({ plan, country, email: initialEmail, onClose, onPay, paying, t }: PaymentModalProps) {
  const [method, setMethod] = useState(country.methods[0]);
  const [email, setEmail] = useState(initialEmail);
  const [visible, setVisible] = useState(false);
  const PlanIcon = plan.icon;
  const currency = country.currency as keyof typeof plan.price;
  const price = plan.price[currency] ?? plan.price.USD;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 220);
  }

  const accentRgb = t.accent.startsWith("hsl")
    ? t.accent
    : t.accent;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4 py-8"
      style={{
        zIndex: 10000,
        background: visible ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(6px)" : "blur(0px)",
        transition: "background 220ms ease, backdrop-filter 220ms ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        data-testid="payment-modal"
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: t.glassEffect ? "rgba(8,15,40,0.97)" : "#0a0a0a",
          border: `1px solid ${t.accentFaded(0.25)}`,
          boxShadow: `0 0 60px ${t.accentFaded(0.12)}, 0 24px 80px rgba(0,0,0,0.6)`,
          transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease",
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.accentFaded(0.12)}`, background: t.accentFaded(0.04) }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: t.accentFaded(0.12) }}>
              <PlanIcon className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>Subscribe to</p>
              <p className="font-bold text-white text-sm leading-tight">{plan.name} Plan</p>
            </div>
          </div>
          <button
            data-testid="button-close-modal"
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/10"
            style={{ color: t.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Price summary */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.18)}` }}
          >
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: t.textMuted }}>Total due today</p>
              <p className="text-2xl font-black text-white font-mono">
                {country.symbol}{price.toLocaleString()}
                <span className="text-xs font-normal ml-1.5" style={{ color: t.textMuted }}>{country.currency}/mo</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: t.textMuted }}>Country</p>
              <p className="text-sm font-mono text-white">{country.flag} {country.name}</p>
            </div>
          </div>

          {/* Features included */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>What's included</p>
            <div className="grid grid-cols-2 gap-1.5">
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2 text-xs font-mono text-gray-300">
                  <Check className="w-3 h-3 flex-shrink-0" style={{ color: t.accent }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Payment method picker */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Payment method</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: country.methods.length === 1 ? "1fr" : "1fr 1fr" }}>
              {country.methods.map(m => {
                const meta = METHOD_META[m];
                const MethodIcon = meta.icon;
                const active = method === m;
                return (
                  <button
                    key={m}
                    data-testid={`method-${m}`}
                    onClick={() => setMethod(m)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: active ? t.accentFaded(0.12) : t.accentFaded(0.04),
                      border: `1px solid ${active ? t.accentFaded(0.45) : t.accentFaded(0.12)}`,
                      boxShadow: active ? `0 0 0 1px ${t.accentFaded(0.2)}` : "none",
                    }}
                  >
                    <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: active ? t.accentFaded(0.2) : t.accentFaded(0.08) }}>
                      <MethodIcon className="w-3.5 h-3.5" style={{ color: active ? t.accent : t.textMuted }} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-bold" style={{ color: active ? t.accent : "white" }}>{meta.label}</p>
                      <p className="text-[9px] font-mono" style={{ color: t.textMuted }}>{meta.desc}</p>
                    </div>
                    {active && (
                      <div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>
              Billing email
            </label>
            <input
              data-testid="input-billing-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none transition-all"
              style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.2)}` }}
            />
          </div>

          {/* Pay button */}
          <button
            data-testid="button-pay-now"
            disabled={paying || !email}
            onClick={() => onPay(method, email)}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all"
            style={{
              background: paying ? t.accentFaded(0.15) : t.accent,
              color: paying ? t.accent : "#000",
              border: `1px solid ${t.accent}`,
              boxShadow: paying ? "none" : `0 0 24px ${t.accentFaded(0.35)}`,
              opacity: !email ? 0.5 : 1,
            }}
          >
            {paying ? (
              <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing…</>
            ) : (
              <>Pay {country.symbol}{price.toLocaleString()} <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: t.textMuted }}>
              <ShieldCheck className="w-3 h-3" style={{ color: t.accent }} /> SSL Secured
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: t.textMuted }}>
              <Lock className="w-3 h-3" style={{ color: t.accent }} /> Powered by Paystack
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Main Billing Page
────────────────────────────────────────────────────────── */
export default function Billing() {
  const { user, updateUserCountry } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();

  const [selectedCountry, setSelectedCountry] = useState(() =>
    getInitialCountry(user?.id, user?.user_metadata?.country)
  );
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [modalPlan, setModalPlan] = useState<typeof PLANS[0] | null>(null);
  const [paying, setPaying] = useState(false);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  function handleCountryChange(c: typeof COUNTRIES[0]) {
    setSelectedCountry(c);
    setShowCountryDrop(false);
    if (user?.id) localStorage.setItem(`wolfdeploy_country_${user.id}`, c.code);
    updateUserCountry(c.code);
  }

  function openModal(planId: string) {
    if (!publicKey) {
      toast({ title: "Payment unavailable", description: "Billing is not configured. Contact support.", variant: "destructive" });
      return;
    }
    const plan = PLANS.find(p => p.id === planId);
    if (plan) setModalPlan(plan);
  }

  function handlePay(method: string, email: string) {
    if (!modalPlan || !publicKey) return;
    const currency = selectedCountry.currency as keyof typeof modalPlan.price;
    const amount = (modalPlan.price[currency] ?? modalPlan.price.USD) * 100;

    setPaying(true);
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email,
      amount,
      currency: selectedCountry.currency,
      channels: [method],
      ref: `WOLF-${Date.now()}-${modalPlan.id}`,
      metadata: { plan: modalPlan.id, userId: user?.id },
      callback: (response: { reference: string }) => {
        setPaying(false);
        setModalPlan(null);
        toast({ title: "Payment successful!", description: `Ref: ${response.reference}. Your plan is now active.` });
      },
      onClose: () => {
        setPaying(false);
      },
    });
    handler.openIframe();
  }

  const cardBg = t.glassEffect ? t.cardBg : "rgba(0,0,0,0.35)";
  const cardBorder = t.glassEffect ? t.cardBorder : t.accentFaded(0.15);
  const panelStyle = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    backdropFilter: t.backdropBlur,
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 min-h-full" data-testid="billing-page">
      {/* Modal */}
      {modalPlan && (
        <PaymentModal
          plan={modalPlan}
          country={selectedCountry}
          email={user?.email ?? ""}
          onClose={() => { setModalPlan(null); setPaying(false); }}
          onPay={handlePay}
          paying={paying}
          t={t}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Billing</h1>
        <p className="text-xs sm:text-sm font-mono" style={{ color: t.textMuted }}>
          Choose a plan and pay securely with Paystack — card or mobile money.
        </p>
      </div>

      {/* Country selector */}
      <div
        className="rounded-xl p-4 sm:p-5"
        style={{ ...panelStyle, position: "relative", zIndex: showCountryDrop ? 20 : "auto" }}
      >
        <p className="text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: t.textMuted }}>
          <Globe className="w-3.5 h-3.5" /> Select Your Country
        </p>
        <div className="relative">
          <button
            data-testid="button-country-select"
            onClick={() => setShowCountryDrop(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
            style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.2)}`, color: "white" }}
          >
            <span className="flex items-center gap-3">
              <span className="text-xl">{selectedCountry.flag}</span>
              <span className="font-mono text-sm">{selectedCountry.name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: t.accentFaded(0.1), color: t.accent }}>
                {selectedCountry.currency}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCountryDrop ? "rotate-180" : ""}`} style={{ color: t.accent }} />
          </button>
          {showCountryDrop && (
            <div
              className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden max-h-72 overflow-y-auto"
              style={{ background: t.glassEffect ? "rgba(8,15,40,0.98)" : "#0c0c0c", border: `1px solid ${t.accentFaded(0.2)}`, backdropFilter: "blur(12px)", zIndex: 9999 }}
            >
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  data-testid={`option-country-${c.code}`}
                  onClick={() => handleCountryChange(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5"
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-mono text-sm text-white flex-1">{c.name}</span>
                  <span className="text-xs font-mono" style={{ color: t.accent }}>{c.currency}</span>
                  <div className="flex gap-1">
                    {c.methods.map(m => (
                      <span key={m} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: t.accentFaded(0.08), color: t.textMuted }}>
                        {m === "mobile_money" ? "Mobile" : m === "bank_transfer" ? "Bank" : m.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: t.textMuted }}>Available methods:</span>
          {selectedCountry.methods.map(m => {
            const meta = METHOD_META[m];
            const MethodIcon = meta.icon;
            return (
              <span key={m} className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-lg" style={{ background: t.accentFaded(0.08), color: t.accent, border: `1px solid ${t.accentFaded(0.15)}` }}>
                <MethodIcon className="w-3 h-3" />
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Plans */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: t.textMuted }}>Choose a Plan</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const currency = selectedCountry.currency as keyof typeof plan.price;
            const price = plan.price[currency] ?? plan.price.USD;
            const PlanIcon = plan.icon;

            return (
              <div
                key={plan.id}
                data-testid={`card-plan-${plan.id}`}
                className="rounded-2xl p-5 sm:p-6 flex flex-col relative overflow-hidden"
                style={{
                  background: plan.highlight ? t.accentFaded(0.06) : cardBg,
                  border: `1px solid ${plan.highlight ? t.accentFaded(0.35) : cardBorder}`,
                  backdropFilter: t.backdropBlur,
                  boxShadow: plan.highlight ? `0 0 40px ${t.accentFaded(0.08)}` : "none",
                }}
              >
                {plan.highlight && (
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: t.accentFaded(0.2), color: t.accent }}>
                      Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl" style={{ background: t.accentFaded(0.1) }}>
                    <PlanIcon className="w-5 h-5" style={{ color: t.accent }} />
                  </div>
                  <span className="font-bold text-white text-lg">{plan.name}</span>
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-black text-white">{selectedCountry.symbol}{price.toLocaleString()}</span>
                  <span className="text-xs font-mono ml-1.5" style={{ color: t.textMuted }}>{selectedCountry.currency}/mo</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs font-mono text-gray-300">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid={`button-subscribe-${plan.id}`}
                  onClick={() => openModal(plan.id)}
                  className="w-full py-3 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  style={{
                    background: plan.highlight ? t.accent : t.accentFaded(0.1),
                    color: plan.highlight ? "#000" : t.accent,
                    border: `1px solid ${plan.highlight ? t.accent : t.accentFaded(0.3)}`,
                  }}
                >
                  <Lock className="w-3.5 h-3.5" /> Subscribe
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security note */}
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.12)}` }}>
        <Lock className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <p className="text-xs font-mono" style={{ color: t.textMuted }}>
          Payments are processed securely by Paystack. WolfDeploy never stores your card or mobile money details.
        </p>
      </div>
    </div>
  );
}
