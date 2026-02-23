import { useState } from "react";
import { Wallet, CreditCard, Smartphone, Globe, Check, Crown, Shield, Zap, Star, ChevronDown, Lock } from "lucide-react";
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
    color: "rgba(74,222,128,1)",
  },
  {
    id: "pro",
    name: "Pro",
    price: { NGN: 22500, GHS: 250, ZAR: 270, KES: 1950, RWF: 16500, TZS: 37500, UGX: 54000, XOF: 9000, XAF: 9000, ZMW: 390, EGP: 465, ETB: 825, USD: 15 },
    icon: Shield,
    features: ["Unlimited Bots", "2GB RAM", "Dedicated CPU", "Priority Support", "Full Log Streaming", "Auto-Restart"],
    highlight: true,
    color: "rgba(74,222,128,1)",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: { NGN: 73500, GHS: 820, ZAR: 880, KES: 6350, RWF: 54000, TZS: 122500, UGX: 176000, XOF: 29500, XAF: 29500, ZMW: 1280, EGP: 1520, ETB: 2700, USD: 49 },
    icon: Crown,
    features: ["Unlimited Bots", "8GB RAM", "Dedicated Server", "24/7 Priority Support", "Custom Domain", "SLA Guarantee"],
    highlight: false,
    color: "rgba(74,222,128,1)",
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

const METHOD_LABELS: Record<string, { label: string; icon: typeof CreditCard }> = {
  card: { label: "Card Payment", icon: CreditCard },
  mobile_money: { label: "Mobile Money", icon: Smartphone },
  bank_transfer: { label: "Bank Transfer", icon: Wallet },
  ussd: { label: "USSD", icon: Smartphone },
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

export default function Billing() {
  const { user, updateUserCountry } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();

  const [selectedCountry, setSelectedCountry] = useState(() =>
    getInitialCountry(user?.id, user?.user_metadata?.country)
  );
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [showCountryDrop, setShowCountryDrop] = useState(false);

  function handleCountryChange(c: typeof COUNTRIES[0]) {
    setSelectedCountry(c);
    setShowCountryDrop(false);
    if (user?.id) localStorage.setItem(`wolfdeploy_country_${user.id}`, c.code);
    updateUserCountry(c.code);
  }

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  function handlePay(planId: string) {
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    if (!publicKey) {
      toast({ title: "Payment unavailable", description: "Billing is not yet configured. Please contact support.", variant: "destructive" });
      return;
    }

    const currency = selectedCountry.currency;
    const amount = plan.price[currency as keyof typeof plan.price] || plan.price.USD;
    const amountKobo = amount * 100;

    setPaying(true);
    setSelectedPlan(planId);

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: user?.email || "",
      amount: amountKobo,
      currency,
      ref: `WOLF-${Date.now()}-${planId}`,
      metadata: { plan: planId, userId: user?.id },
      callback: (response: { reference: string }) => {
        setPaying(false);
        setSelectedPlan(null);
        toast({ title: "Payment successful!", description: `Reference: ${response.reference}. Your plan has been activated.` });
      },
      onClose: () => {
        setPaying(false);
        setSelectedPlan(null);
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

        {/* Payment methods for selected country */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: t.textMuted }}>Available methods:</span>
          {selectedCountry.methods.map(m => {
            const meta = METHOD_LABELS[m];
            return (
              <span key={m} className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-lg" style={{ background: t.accentFaded(0.08), color: t.accent, border: `1px solid ${t.accentFaded(0.15)}` }}>
                <meta.icon className="w-3 h-3" />
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
            const price = plan.price[currency] || plan.price.USD;
            const symbol = selectedCountry.symbol;
            const isPaying = paying && selectedPlan === plan.id;
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
                  <span className="font-bold text-white text-lg font-display">{plan.name}</span>
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-display font-black text-white">{symbol}{price.toLocaleString()}</span>
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
                  onClick={() => handlePay(plan.id)}
                  disabled={isPaying}
                  className="w-full py-3 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  style={{
                    background: plan.highlight ? t.accent : t.accentFaded(0.1),
                    color: plan.highlight ? "#000" : t.accent,
                    border: `1px solid ${plan.highlight ? t.accent : t.accentFaded(0.3)}`,
                    opacity: isPaying ? 0.7 : 1,
                  }}
                >
                  {isPaying ? (
                    <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing...</>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" /> Subscribe</>
                  )}
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
