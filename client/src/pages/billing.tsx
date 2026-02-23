import { useState, useEffect } from "react";
import { Wallet, CreditCard, Smartphone, Globe, ChevronDown, Lock, X, ArrowRight, ShieldCheck, Banknote, Coins, Bot, Zap, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";

/* ── Exchange rates (1 KES = N units of each currency) ── */
const KES_RATES: Record<string, number> = {
  KES: 1,
  NGN: 8.55,
  GHS: 0.118,
  ZAR: 0.138,
  RWF: 9.5,
  TZS: 20.5,
  UGX: 36.5,
  XOF: 5.4,
  XAF: 5.4,
  ZMW: 0.077,
  EGP: 0.36,
  ETB: 0.42,
  USD: 0.0077,
};

/* Base: 10 coins = 70 KES → 7 KES per coin */
const KES_PER_COIN = 7;

function coinsToPrice(coins: number, currency: string): number {
  const rate = KES_RATES[currency] ?? KES_RATES.USD;
  const raw = coins * KES_PER_COIN * rate;
  /* Round to a clean number */
  if (raw >= 1000) return Math.round(raw / 50) * 50;
  if (raw >= 100)  return Math.round(raw / 5) * 5;
  if (raw >= 10)   return Math.round(raw);
  return parseFloat(raw.toFixed(2));
}

/* ── Coin packages ── */
const PACKAGES = [
  {
    id: "mini",
    coins: 10,
    bots: 1,
    bonus: 0,
    label: "Mini Pack",
    icon: Bot,
    popular: false,
    tagline: "Perfect to get started",
  },
  {
    id: "starter",
    coins: 50,
    bots: 5,
    bonus: 0,
    label: "Starter Pack",
    icon: Zap,
    popular: false,
    tagline: "Run 5 bots at once",
  },
  {
    id: "power",
    coins: 100,
    bots: 10,
    bonus: 10,
    label: "Power Pack",
    icon: Star,
    popular: true,
    tagline: "10 bots + 10 bonus coins",
  },
  {
    id: "mega",
    coins: 500,
    bots: 50,
    bonus: 75,
    label: "Mega Pack",
    icon: Coins,
    popular: false,
    tagline: "50 bots + 75 bonus coins",
  },
];

const COUNTRIES = [
  { code: "NG", name: "Nigeria",        currency: "NGN", symbol: "₦",    flag: "🇳🇬", methods: ["card", "bank_transfer", "ussd"] },
  { code: "GH", name: "Ghana",          currency: "GHS", symbol: "₵",    flag: "🇬🇭", methods: ["card", "mobile_money"] },
  { code: "KE", name: "Kenya",          currency: "KES", symbol: "KSh",  flag: "🇰🇪", methods: ["card", "mobile_money"] },
  { code: "ZA", name: "South Africa",   currency: "ZAR", symbol: "R",    flag: "🇿🇦", methods: ["card"] },
  { code: "RW", name: "Rwanda",         currency: "RWF", symbol: "FRw",  flag: "🇷🇼", methods: ["card", "mobile_money"] },
  { code: "TZ", name: "Tanzania",       currency: "TZS", symbol: "TSh",  flag: "🇹🇿", methods: ["card", "mobile_money"] },
  { code: "UG", name: "Uganda",         currency: "UGX", symbol: "USh",  flag: "🇺🇬", methods: ["card", "mobile_money"] },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", symbol: "CFA",  flag: "🇨🇮", methods: ["card", "mobile_money"] },
  { code: "CM", name: "Cameroon",       currency: "XAF", symbol: "FCFA", flag: "🇨🇲", methods: ["card", "mobile_money"] },
  { code: "ZM", name: "Zambia",         currency: "ZMW", symbol: "ZK",   flag: "🇿🇲", methods: ["card", "mobile_money"] },
  { code: "EG", name: "Egypt",          currency: "EGP", symbol: "E£",   flag: "🇪🇬", methods: ["card"] },
  { code: "ET", name: "Ethiopia",       currency: "ETB", symbol: "Br",   flag: "🇪🇹", methods: ["card"] },
  { code: "SN", name: "Senegal",        currency: "XOF", symbol: "CFA",  flag: "🇸🇳", methods: ["card", "mobile_money"] },
  { code: "XX", name: "Others (USD)",   currency: "USD", symbol: "$",    flag: "🌐", methods: ["card"] },
];

const METHOD_META: Record<string, { label: string; desc: string; icon: typeof CreditCard }> = {
  card:          { label: "Card",          desc: "Visa / Mastercard",    icon: CreditCard },
  mobile_money:  { label: "Mobile Money",  desc: "MTN, M-Pesa & more",   icon: Smartphone },
  bank_transfer: { label: "Bank Transfer", desc: "Direct bank transfer", icon: Banknote },
  ussd:          { label: "USSD",          desc: "*737#, *919# & more",  icon: Smartphone },
};

declare global {
  interface Window {
    PaystackPop: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
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
interface ModalProps {
  pkg: typeof PACKAGES[0];
  country: typeof COUNTRIES[0];
  email: string;
  onClose: () => void;
  onPay: (method: string, email: string) => void;
  paying: boolean;
  t: ReturnType<typeof getThemeTokens>;
}

function PaymentModal({ pkg, country, email: initEmail, onClose, onPay, paying, t }: ModalProps) {
  const [method, setMethod] = useState(country.methods[0]);
  const [email, setEmail] = useState(initEmail);
  const [visible, setVisible] = useState(false);
  const PkgIcon = pkg.icon;
  const price = coinsToPrice(pkg.coins, country.currency);
  const totalCoins = pkg.coins + pkg.bonus;

  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 220);
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4 py-8"
      style={{
        zIndex: 10000,
        background: visible ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(6px)" : "blur(0px)",
        transition: "background 220ms ease, backdrop-filter 220ms ease",
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        data-testid="payment-modal"
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: t.glassEffect ? "rgba(8,15,40,0.97)" : "#0a0a0a",
          border: `1px solid ${t.accentFaded(0.28)}`,
          boxShadow: `0 0 60px ${t.accentFaded(0.14)}, 0 24px 80px rgba(0,0,0,0.6)`,
          transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.accentFaded(0.12)}`, background: t.accentFaded(0.04) }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: t.accentFaded(0.12) }}>
              <PkgIcon className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>Purchasing</p>
              <p className="font-bold text-white text-sm leading-tight">{pkg.label}</p>
            </div>
          </div>
          <button data-testid="button-close-modal" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: t.textMuted }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Coin summary */}
          <div className="rounded-xl p-4" style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.2)}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: t.textMuted }}>You receive</p>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5" style={{ color: t.accent }} />
                  <span className="text-2xl font-black text-white font-mono">{totalCoins}</span>
                  <span className="text-sm font-mono" style={{ color: t.textMuted }}>coins</span>
                  {pkg.bonus > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold" style={{ background: t.accentFaded(0.2), color: t.accent }}>
                      +{pkg.bonus} bonus
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: t.textMuted }}>Supports</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <Bot className="w-4 h-4" style={{ color: t.accent }} />
                  <span className="text-sm font-bold text-white font-mono">{pkg.bots} bot{pkg.bots > 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${t.accentFaded(0.12)}` }}>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>Total due</p>
              <p className="text-xl font-black text-white font-mono">
                {country.symbol}{price.toLocaleString()}
                <span className="text-xs font-normal ml-1.5" style={{ color: t.textMuted }}>{country.currency}</span>
              </p>
            </div>
          </div>

          {/* Payment method */}
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
                    {active && <div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.accent }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>Billing email</label>
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
            {paying
              ? <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing…</>
              : <>Pay {country.symbol}{price.toLocaleString()} <ArrowRight className="w-4 h-4" /></>
            }
          </button>

          {/* Trust */}
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
  const [modalPkg, setModalPkg] = useState<typeof PACKAGES[0] | null>(null);
  const [paying, setPaying] = useState(false);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  function handleCountryChange(c: typeof COUNTRIES[0]) {
    setSelectedCountry(c);
    setShowCountryDrop(false);
    if (user?.id) localStorage.setItem(`wolfdeploy_country_${user.id}`, c.code);
    updateUserCountry(c.code);
  }

  function openModal(pkgId: string) {
    if (!publicKey) {
      toast({ title: "Payment unavailable", description: "Billing is not configured. Contact support.", variant: "destructive" });
      return;
    }
    const pkg = PACKAGES.find(p => p.id === pkgId);
    if (pkg) setModalPkg(pkg);
  }

  function handlePay(method: string, email: string) {
    if (!modalPkg || !publicKey) return;
    const price = coinsToPrice(modalPkg.coins, selectedCountry.currency);
    const amountMinor = Math.round(price * 100);

    setPaying(true);
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email,
      amount: amountMinor,
      currency: selectedCountry.currency,
      channels: [method],
      ref: `WOLF-${Date.now()}-${modalPkg.id}`,
      metadata: { package: modalPkg.id, coins: modalPkg.coins + modalPkg.bonus, userId: user?.id },
      callback: (response: { reference: string }) => {
        setPaying(false);
        setModalPkg(null);
        toast({ title: `${modalPkg.coins + modalPkg.bonus} coins added!`, description: `Ref: ${response.reference}. Coins have been credited to your account.` });
      },
      onClose: () => setPaying(false),
    });
    handler.openIframe();
  }

  const cardBg = t.glassEffect ? t.cardBg : "rgba(0,0,0,0.35)";
  const cardBorder = t.glassEffect ? t.cardBorder : t.accentFaded(0.15);

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 min-h-full" data-testid="billing-page">
      {modalPkg && (
        <PaymentModal
          pkg={modalPkg}
          country={selectedCountry}
          email={user?.email ?? ""}
          onClose={() => { setModalPkg(null); setPaying(false); }}
          onPay={handlePay}
          paying={paying}
          t={t}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Buy Coins</h1>
        <p className="text-xs sm:text-sm font-mono" style={{ color: t.textMuted }}>
          Coins power your bot deployments. 10 coins = 1 bot instance. Pay once, deploy anytime.
        </p>
      </div>

      {/* How it works */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: Coins,  label: "Buy coins",       desc: "Choose a coin pack below" },
          { icon: Bot,    label: "Deploy bots",      desc: "10 coins = 1 bot instance" },
          { icon: Zap,    label: "Instant credit",   desc: "Coins added immediately" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 min-w-[160px]" style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.1)}` }}>
            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: t.accentFaded(0.1) }}>
              <Icon className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono">{label}</p>
              <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Country selector */}
      <div
        className="rounded-xl p-4 sm:p-5"
        style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: t.backdropBlur, position: "relative", zIndex: showCountryDrop ? 20 : "auto" }}
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
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: t.accentFaded(0.1), color: t.accent }}>{selectedCountry.currency}</span>
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
      </div>

      {/* Coin packages */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: t.textMuted }}>Choose a coin pack</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PACKAGES.map(pkg => {
            const price = coinsToPrice(pkg.coins, selectedCountry.currency);
            const totalCoins = pkg.coins + pkg.bonus;
            const PkgIcon = pkg.icon;
            return (
              <div
                key={pkg.id}
                data-testid={`card-package-${pkg.id}`}
                className="rounded-2xl p-5 flex flex-col relative"
                style={{
                  background: pkg.popular ? t.accentFaded(0.07) : cardBg,
                  border: `1px solid ${pkg.popular ? t.accentFaded(0.38) : cardBorder}`,
                  backdropFilter: t.backdropBlur,
                  boxShadow: pkg.popular ? `0 0 40px ${t.accentFaded(0.1)}` : "none",
                }}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: t.accent, color: "#000" }}>
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl" style={{ background: t.accentFaded(0.1) }}>
                    <PkgIcon className="w-4 h-4" style={{ color: t.accent }} />
                  </div>
                  <span className="font-bold text-white text-sm font-mono">{pkg.label}</span>
                </div>

                {/* Coin count */}
                <div className="mb-1">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white font-mono">{totalCoins}</span>
                    <span className="text-sm font-mono mb-1" style={{ color: t.accent }}>coins</span>
                  </div>
                  {pkg.bonus > 0 && (
                    <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>
                      {pkg.coins} + <span style={{ color: t.accent }}>{pkg.bonus} bonus</span>
                    </p>
                  )}
                </div>

                {/* Price */}
                <div className="mb-3">
                  <span className="text-lg font-bold text-white">{selectedCountry.symbol}{price.toLocaleString()}</span>
                  <span className="text-xs font-mono ml-1.5" style={{ color: t.textMuted }}>{selectedCountry.currency}</span>
                </div>

                {/* Bot capacity */}
                <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg" style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.12)}` }}>
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
                  <span className="text-xs font-mono text-white">Supports <strong>{pkg.bots}</strong> bot{pkg.bots > 1 ? "s" : ""}</span>
                </div>

                <p className="text-[10px] font-mono mb-5 flex-1" style={{ color: t.textMuted }}>{pkg.tagline}</p>

                <button
                  data-testid={`button-buy-${pkg.id}`}
                  onClick={() => openModal(pkg.id)}
                  className="w-full py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  style={{
                    background: pkg.popular ? t.accent : t.accentFaded(0.1),
                    color: pkg.popular ? "#000" : t.accent,
                    border: `1px solid ${pkg.popular ? t.accent : t.accentFaded(0.3)}`,
                    boxShadow: pkg.popular ? `0 0 16px ${t.accentFaded(0.3)}` : "none",
                  }}
                >
                  <Coins className="w-3.5 h-3.5" /> Buy Coins
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rate info */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.12)}` }}>
        <Coins className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
        <div>
          <p className="text-xs font-mono text-white mb-0.5">
            Base rate: <span style={{ color: t.accent }}>10 coins = KSh 70</span>
            {selectedCountry.currency !== "KES" && (
              <> = <span style={{ color: t.accent }}>{selectedCountry.symbol}{coinsToPrice(10, selectedCountry.currency).toLocaleString()} {selectedCountry.currency}</span></>
            )}
          </p>
          <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>
            Prices are auto-converted from KES. 1 coin = 1/10th of a bot deployment. Payments secured by Paystack.
          </p>
        </div>
      </div>
    </div>
  );
}
