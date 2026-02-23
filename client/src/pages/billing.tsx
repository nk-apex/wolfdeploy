import { useState, useEffect } from "react";
import { Wallet, CreditCard, Smartphone, Globe, ChevronDown, Lock, X, ArrowRight, ShieldCheck, Banknote, Coins, Bot, Zap, Star, Calculator, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/* ── Exchange rates: 1 KES = N units of each currency ── */
const KES_RATES: Record<string, number> = {
  KES: 1, NGN: 8.55, GHS: 0.118, ZAR: 0.138,
  RWF: 9.5, TZS: 20.5, UGX: 36.5, XOF: 5.4,
  XAF: 5.4, ZMW: 0.077, EGP: 0.36, ETB: 0.42, USD: 0.0077,
};

const KES_PER_COIN = 7; /* Base: 10 coins = 70 KES */

function coinsToPrice(coins: number, currency: string): number {
  const rate = KES_RATES[currency] ?? KES_RATES.USD;
  const raw = coins * KES_PER_COIN * rate;
  if (raw >= 1000) return Math.round(raw / 50) * 50;
  if (raw >= 100) return Math.round(raw / 5) * 5;
  if (raw >= 10) return Math.round(raw);
  return parseFloat(raw.toFixed(2));
}

function priceToCoins(price: number, currency: string): number {
  const rate = KES_RATES[currency] ?? KES_RATES.USD;
  return Math.floor(price / (KES_PER_COIN * rate));
}

const PACKAGES = [
  { id: "mini",    coins: 10,  bots: 1,  bonus: 0,  label: "Mini Pack",    icon: Bot,     popular: false, tagline: "Get started with 1 bot" },
  { id: "starter", coins: 50,  bots: 5,  bonus: 0,  label: "Starter Pack", icon: Zap,     popular: false, tagline: "Run up to 5 bots" },
  { id: "power",   coins: 100, bots: 10, bonus: 10, label: "Power Pack",   icon: Star,    popular: true,  tagline: "10 bots + 10 bonus coins" },
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
interface ModalState {
  coins: number;
  bonus: number;
  label: string;
  icon: typeof Bot;
}

interface ModalProps {
  pkg: ModalState;
  country: typeof COUNTRIES[0];
  userEmail: string;
  userId: string;
  onClose: () => void;
  onSuccess: (coins: number, ref: string) => void;
  t: ReturnType<typeof getThemeTokens>;
}

const STK_STEPS = [
  { label: "Initiating payment",        sub: "Connecting to Paystack…" },
  { label: "Sending STK push",          sub: "Payment prompt on its way…" },
  { label: "STK pushed to your phone",  sub: "Check your phone now." },
  { label: "Waiting for PIN",           sub: "Enter your PIN on your phone…" },
  { label: "Verifying payment",         sub: "Confirming with mobile network…" },
];

function PaymentModal({ pkg, country, userEmail, userId, onClose, onSuccess, t }: ModalProps) {
  const { toast } = useToast();
  const [method, setMethod] = useState(country.methods[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [visible, setVisible] = useState(false);
  /* payStep: 0=idle, 1=init, 2=stk_sent, 3=waiting_pin, 4=verifying, 5=done */
  const [payStep, setPayStep] = useState(0);
  const [payRef, setPayRef] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const isMobileMoney = method === "mobile_money";
  const PkgIcon = pkg.icon;
  const price = coinsToPrice(pkg.coins, country.currency);
  const totalCoins = pkg.coins + pkg.bonus;
  const bots = Math.floor(totalCoins / 10);

  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  function handleClose() {
    if (payStep > 0 && payStep < 5) return;
    setVisible(false);
    setTimeout(onClose, 220);
  }

  function handleCancel() {
    setPayStep(0);
    setErrMsg("");
  }

  async function handlePay() {
    setErrMsg("");
    const ref = `WOLF-${Date.now()}-c${totalCoins}`;
    /* Strip + and spaces from phone */
    const cleanPhone = phone.replace(/^\+/, "").replace(/\s+/g, "");
    const amountMinor = Math.round(price * 100);

    /* Step 1 — initiating */
    setPayStep(1);
    try {
      const initRes = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isMobileMoney ? `${cleanPhone}@mobile.wolfdeploy.app` : email,
          amount: amountMinor,
          currency: country.currency,
          channels: [method],
          phone: isMobileMoney ? cleanPhone : undefined,
          reference: ref,
          userId,
          coins: totalCoins,
        }),
      });
      const initData = await initRes.json() as { authorizationUrl?: string; error?: string };
      if (!initRes.ok || !initData.authorizationUrl) {
        setPayStep(0);
        setErrMsg(initData.error || "Failed to initialise payment. Try again.");
        return;
      }

      setPayRef(ref);

      if (isMobileMoney) {
        /* Step 2 — STK sent */
        setPayStep(2);
        /* Open Paystack page in new tab so user can confirm */
        window.open(initData.authorizationUrl, "_blank", "noopener");
        /* Step 3 — waiting for PIN */
        setTimeout(() => setPayStep(3), 2000);
        /* Step 4 — verifying (after reasonable wait) */
        setTimeout(async () => {
          setPayStep(4);
          await verifyPayment(ref, totalCoins);
        }, 18000);
      } else {
        /* Card / USSD / bank — open Paystack page, poll after close */
        setPayStep(2);
        const win = window.open(initData.authorizationUrl, "_blank", "width=600,height=700,noopener");
        const poll = setInterval(() => {
          if (!win || win.closed) {
            clearInterval(poll);
            setPayStep(4);
            verifyPayment(ref, totalCoins);
          }
        }, 1200);
      }
    } catch {
      setPayStep(0);
      setErrMsg("Network error. Please check your connection and try again.");
    }
  }

  async function verifyPayment(ref: string, coins: number) {
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref, userId, coins }),
      });
      const data = await res.json() as { success?: boolean; balance?: number; error?: string };
      if (res.ok && data.success) {
        setPayStep(5);
        setTimeout(() => {
          onSuccess(coins, ref);
        }, 1200);
      } else {
        setPayStep(0);
        setErrMsg(data.error || "Payment not confirmed yet. If you paid, your coins will be credited shortly.");
      }
    } catch {
      setPayStep(0);
      setErrMsg("Could not verify payment. Contact support if amount was deducted.");
    }
  }

  const canPay = isMobileMoney ? !!phone.trim() : !!email.trim();
  const isProcessing = payStep > 0 && payStep < 5;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4 py-8"
      style={{ zIndex: 10000, background: visible ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0)", backdropFilter: visible ? "blur(6px)" : "blur(0px)", transition: "background 220ms ease, backdrop-filter 220ms ease" }}
      onClick={e => { if (e.target === e.currentTarget && !isProcessing) handleClose(); }}
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
              <p className="font-bold text-white text-sm">{pkg.label}</p>
            </div>
          </div>
          {!isProcessing && (
            <button data-testid="button-close-modal" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: t.textMuted }}>
              <X className="w-4 h-4" />
            </button>
          )}
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold" style={{ background: t.accentFaded(0.2), color: t.accent }}>+{pkg.bonus} bonus</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: t.textMuted }}>Supports</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <Bot className="w-4 h-4" style={{ color: t.accent }} />
                  <span className="text-sm font-bold text-white font-mono">{bots} bot{bots !== 1 ? "s" : ""}</span>
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

          {/* Payment method — hidden while processing */}
          {!isProcessing && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Payment method</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: country.methods.length === 1 ? "1fr" : "1fr 1fr" }}>
                {country.methods.map(m => {
                  const meta = METHOD_META[m];
                  const MethodIcon = meta.icon;
                  const active = method === m;
                  return (
                    <button key={m} data-testid={`method-${m}`} onClick={() => setMethod(m)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{ background: active ? t.accentFaded(0.12) : t.accentFaded(0.04), border: `1px solid ${active ? t.accentFaded(0.45) : t.accentFaded(0.12)}` }}>
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
          )}

          {/* Phone (mobile money only) — no email */}
          {isMobileMoney && !isProcessing && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>
                Phone number (STK push)
              </label>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${t.accentFaded(0.3)}`, background: t.accentFaded(0.08) }}>
                <span className="px-3 py-2.5 text-sm font-mono font-bold border-r" style={{ color: t.accent, borderColor: t.accentFaded(0.2), background: t.accentFaded(0.05) }}>254</span>
                <input
                  data-testid="input-billing-phone"
                  type="tel"
                  placeholder="712345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 px-3 py-2.5 text-sm font-mono text-white outline-none bg-transparent"
                />
              </div>
              <p className="text-[9px] font-mono mt-1" style={{ color: t.textMuted }}>
                Enter number without country code — STK push sent to 254{phone || "XXXXXXXXX"}
              </p>
            </div>
          )}

          {/* Email (card / USSD / bank only) */}
          {!isMobileMoney && !isProcessing && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>Billing email</label>
              <input data-testid="input-billing-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none transition-all"
                style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.2)}` }} />
            </div>
          )}

          {/* Error message */}
          {errMsg && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-red-400">{errMsg}</p>
            </div>
          )}

          {/* ── Pay button / inline step progress ── */}
          {payStep === 0 ? (
            /* Normal pay button */
            <button
              data-testid="button-pay-now"
              disabled={!canPay}
              onClick={handlePay}
              className="w-full py-3.5 rounded-xl font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all"
              style={{ background: t.accent, color: "#000", border: `1px solid ${t.accent}`, boxShadow: `0 0 24px ${t.accentFaded(0.35)}`, opacity: canPay ? 1 : 0.45 }}
            >
              {isMobileMoney
                ? <><Smartphone className="w-4 h-4" /> Send STK Push · {country.symbol}{price.toLocaleString()}</>
                : <>Pay {country.symbol}{price.toLocaleString()} <ArrowRight className="w-4 h-4" /></>}
            </button>
          ) : payStep === 5 ? (
            /* Success state */
            <div className="w-full py-4 rounded-xl flex items-center justify-center gap-2.5 font-mono text-sm font-bold" style={{ background: t.accentFaded(0.1), border: `1px solid ${t.accentFaded(0.4)}`, color: t.accent }}>
              ✓ Payment confirmed — coins added!
            </div>
          ) : (
            /* Inline step progress — replaces button */
            <div data-testid="stk-steps" className="w-full rounded-xl overflow-hidden" style={{ border: `1px solid ${t.accentFaded(0.25)}`, background: t.accentFaded(0.04) }}>
              <div className="px-4 pt-4 pb-3 space-y-3">
                {(isMobileMoney ? STK_STEPS : STK_STEPS.filter((_, i) => i !== 2 && i !== 3)).map((s, idx) => {
                  const realIdx = isMobileMoney ? idx : [0, 1, 4][idx];
                  const done = payStep > realIdx + 1;
                  const active = payStep === realIdx + 1;
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                        style={{
                          background: done ? t.accent : active ? t.accentFaded(0.18) : t.accentFaded(0.04),
                          border: `1.5px solid ${done ? t.accent : active ? t.accentFaded(0.55) : t.accentFaded(0.15)}`,
                          boxShadow: active ? `0 0 8px ${t.accentFaded(0.4)}` : "none",
                        }}
                      >
                        {done
                          ? <span style={{ color: "#000", fontSize: "9px", fontWeight: 900 }}>✓</span>
                          : active
                            ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: t.accent }} />
                            : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono transition-all duration-300 truncate"
                          style={{ color: done ? t.accent : active ? "white" : t.accentFaded(0.3), fontWeight: active || done ? 700 : 400 }}>
                          {s.label}{active && <span className="animate-pulse">…</span>}
                        </p>
                        {active && <p className="text-[9px] font-mono" style={{ color: t.textMuted }}>{s.sub}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isMobileMoney && payStep >= 2 && payStep < 5 && (
                <div className="px-4 pb-3">
                  <p className="text-[9px] font-mono text-center mb-2" style={{ color: t.textMuted }}>
                    STK push sent to 254{phone} — enter PIN when prompted
                  </p>
                </div>
              )}
              <div className="px-4 pb-4">
                <button
                  data-testid="button-cancel-payment"
                  onClick={handleCancel}
                  className="w-full py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", color: "rgba(239,68,68,0.65)" }}
                >
                  Cancel Payment
                </button>
              </div>
            </div>
          )}

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
   Custom Pack Calculator
────────────────────────────────────────────────────────── */
interface CustomPackProps {
  country: typeof COUNTRIES[0];
  t: ReturnType<typeof getThemeTokens>;
  onBuy: (coins: number, bonus: number, label: string) => void;
}

function CustomPackCalculator({ country, t, onBuy }: CustomPackProps) {
  const [mode, setMode] = useState<"coins" | "amount">("coins");
  const [coinsInput, setCoinsInput] = useState("");
  const [amountInput, setAmountInput] = useState("");

  const coins = mode === "coins"
    ? Math.max(0, parseInt(coinsInput) || 0)
    : priceToCoins(parseFloat(amountInput) || 0, country.currency);

  const price = mode === "amount"
    ? parseFloat(amountInput) || 0
    : coinsToPrice(coins, country.currency);

  const bots = Math.floor(coins / 10);
  const valid = coins >= 10;

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.25)", border: `2px dashed ${t.accentFaded(0.25)}` }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl" style={{ background: t.accentFaded(0.1) }}>
          <Calculator className="w-4 h-4" style={{ color: t.accent }} />
        </div>
        <div>
          <p className="font-bold text-white text-sm font-mono">Custom Pack</p>
          <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>Enter coins or amount — we calculate the rest</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        {(["coins", "amount"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all"
            style={{ background: mode === m ? t.accentFaded(0.15) : t.accentFaded(0.05), border: `1px solid ${mode === m ? t.accentFaded(0.4) : t.accentFaded(0.12)}`, color: mode === m ? t.accent : t.textMuted }}>
            {m === "coins" ? "Enter Coins" : `Enter ${country.currency}`}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>
            <Coins className="w-3 h-3 inline mr-1" />Coins
          </label>
          <input
            data-testid="input-custom-coins"
            type="number"
            min={10}
            placeholder="e.g. 30"
            value={mode === "coins" ? coinsInput : coins || ""}
            onChange={e => { setMode("coins"); setCoinsInput(e.target.value); }}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none"
            style={{ background: mode === "coins" ? t.accentFaded(0.08) : t.accentFaded(0.03), border: `1px solid ${mode === "coins" ? t.accentFaded(0.35) : t.accentFaded(0.15)}` }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>
            <Wallet className="w-3 h-3 inline mr-1" />{country.currency} Amount
          </label>
          <input
            data-testid="input-custom-amount"
            type="number"
            min={1}
            placeholder={`e.g. ${coinsToPrice(30, country.currency)}`}
            value={mode === "amount" ? amountInput : price > 0 ? price : ""}
            onChange={e => { setMode("amount"); setAmountInput(e.target.value); }}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none"
            style={{ background: mode === "amount" ? t.accentFaded(0.08) : t.accentFaded(0.03), border: `1px solid ${mode === "amount" ? t.accentFaded(0.35) : t.accentFaded(0.15)}` }}
          />
        </div>
      </div>

      {/* Calculated result */}
      {coins > 0 && (
        <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.15)}` }}>
          <div className="flex items-center gap-3">
            <Coins className="w-4 h-4" style={{ color: t.accent }} />
            <div>
              <p className="text-xs font-mono font-bold text-white">{coins} coins</p>
              <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>
                supports <span style={{ color: t.accent }}>{bots} bot{bots !== 1 ? "s" : ""}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-white font-mono">{country.symbol}{coinsToPrice(coins, country.currency).toLocaleString()}</p>
            <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>{country.currency}</p>
          </div>
        </div>
      )}

      {!valid && coins > 0 && (
        <p className="text-[10px] font-mono mb-3 flex items-center gap-1.5" style={{ color: "#f97316" }}>
          <AlertCircle className="w-3 h-3" /> Minimum is 10 coins (1 bot)
        </p>
      )}

      <button
        data-testid="button-buy-custom"
        disabled={!valid}
        onClick={() => onBuy(coins, 0, `${coins} Coins`)}
        className="w-full py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all"
        style={{ background: valid ? t.accentFaded(0.12) : t.accentFaded(0.04), color: valid ? t.accent : t.textMuted, border: `1px solid ${valid ? t.accentFaded(0.3) : t.accentFaded(0.1)}`, opacity: valid ? 1 : 0.5 }}>
        <Coins className="w-3.5 h-3.5" /> Buy {coins > 0 ? `${coins} Coins` : "Coins"}
      </button>
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
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/coins/${user!.id}`);
      return res.json();
    },
  });
  const balance = coinData?.balance ?? 0;

  function handleCountryChange(c: typeof COUNTRIES[0]) {
    setSelectedCountry(c);
    setShowCountryDrop(false);
    if (user?.id) localStorage.setItem(`wolfdeploy_country_${user.id}`, c.code);
    updateUserCountry(c.code);
  }

  function openModal(coins: number, bonus: number, label: string, icon = Bot as typeof Bot) {
    setModalState({ coins, bonus, label, icon });
  }

  function openPackModal(pkg: typeof PACKAGES[0]) {
    openModal(pkg.coins, pkg.bonus, pkg.label, pkg.icon);
  }

  function handleSuccess(coins: number, ref: string) {
    setModalState(null);
    queryClient.invalidateQueries({ queryKey: ["/api/coins", user?.id] });
    toast({ title: `${coins} coins added!`, description: `Ref: ${ref}. Your coin balance has been updated.` });
  }

  const cardBg = t.glassEffect ? t.cardBg : "rgba(0,0,0,0.35)";
  const cardBorder = t.glassEffect ? t.cardBorder : t.accentFaded(0.15);

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 min-h-full" data-testid="billing-page">
      {modalState && user && (
        <PaymentModal
          pkg={modalState}
          country={selectedCountry}
          userEmail={user.email ?? ""}
          userId={user.id}
          onClose={() => setModalState(null)}
          onSuccess={handleSuccess}
          t={t}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Buy Coins</h1>
        <p className="text-xs sm:text-sm font-mono" style={{ color: t.textMuted }}>
          Coins power your bots. 10 coins = 1 bot instance. Pay once, deploy anytime.
        </p>
      </div>

      {/* Coin balance banner */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: t.accentFaded(0.07), border: `1px solid ${t.accentFaded(0.25)}` }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: t.accentFaded(0.15) }}>
            <Coins className="w-5 h-5" style={{ color: t.accent }} />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>Your Coin Balance</p>
            <p className="text-2xl font-black text-white font-mono">{balance} <span className="text-sm font-normal" style={{ color: t.textMuted }}>coins</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: t.textMuted }}>Can deploy</p>
          <div className="flex items-center gap-1.5 justify-end">
            <Bot className="w-4 h-4" style={{ color: t.accent }} />
            <span className="text-lg font-black text-white font-mono">{Math.floor(balance / 10)}</span>
            <span className="text-xs font-mono" style={{ color: t.textMuted }}>bots</span>
          </div>
        </div>
      </div>

      {/* Country selector */}
      <div className="rounded-xl p-4 sm:p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: t.backdropBlur, position: "relative", zIndex: showCountryDrop ? 20 : "auto" }}>
        <p className="text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: t.textMuted }}>
          <Globe className="w-3.5 h-3.5" /> Select Your Country
        </p>
        <div className="relative">
          <button data-testid="button-country-select" onClick={() => setShowCountryDrop(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
            style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.2)}`, color: "white" }}>
            <span className="flex items-center gap-3">
              <span className="text-xl">{selectedCountry.flag}</span>
              <span className="font-mono text-sm">{selectedCountry.name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: t.accentFaded(0.1), color: t.accent }}>{selectedCountry.currency}</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCountryDrop ? "rotate-180" : ""}`} style={{ color: t.accent }} />
          </button>
          {showCountryDrop && (
            <div className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden max-h-72 overflow-y-auto"
              style={{ background: t.glassEffect ? "rgba(8,15,40,0.98)" : "#0c0c0c", border: `1px solid ${t.accentFaded(0.2)}`, backdropFilter: "blur(12px)", zIndex: 9999 }}>
              {COUNTRIES.map(c => (
                <button key={c.code} data-testid={`option-country-${c.code}`} onClick={() => handleCountryChange(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5">
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

      {/* Preset packages */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: t.textMuted }}>Coin Packs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PACKAGES.map(pkg => {
            const price = coinsToPrice(pkg.coins, selectedCountry.currency);
            const totalCoins = pkg.coins + pkg.bonus;
            const PkgIcon = pkg.icon;
            return (
              <div key={pkg.id} data-testid={`card-package-${pkg.id}`} className="rounded-2xl p-5 flex flex-col relative"
                style={{ background: pkg.popular ? t.accentFaded(0.07) : cardBg, border: `1px solid ${pkg.popular ? t.accentFaded(0.38) : cardBorder}`, backdropFilter: t.backdropBlur, boxShadow: pkg.popular ? `0 0 40px ${t.accentFaded(0.1)}` : "none" }}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: t.accent, color: "#000" }}>Most Popular</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl" style={{ background: t.accentFaded(0.1) }}>
                    <PkgIcon className="w-4 h-4" style={{ color: t.accent }} />
                  </div>
                  <span className="font-bold text-white text-sm font-mono">{pkg.label}</span>
                </div>
                <div className="mb-1">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white font-mono">{totalCoins}</span>
                    <span className="text-sm font-mono mb-1" style={{ color: t.accent }}>coins</span>
                  </div>
                  {pkg.bonus > 0 && <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>{pkg.coins} + <span style={{ color: t.accent }}>{pkg.bonus} bonus</span></p>}
                </div>
                <div className="mb-3">
                  <span className="text-lg font-bold text-white">{selectedCountry.symbol}{price.toLocaleString()}</span>
                  <span className="text-xs font-mono ml-1.5" style={{ color: t.textMuted }}>{selectedCountry.currency}</span>
                </div>
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.12)}` }}>
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
                  <span className="text-xs font-mono text-white">Supports <strong>{pkg.bots}</strong> bot{pkg.bots > 1 ? "s" : ""}</span>
                </div>
                <p className="text-[10px] font-mono mb-4 flex-1" style={{ color: t.textMuted }}>{pkg.tagline}</p>
                <button data-testid={`button-buy-${pkg.id}`} onClick={() => openPackModal(pkg)}
                  className="w-full py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  style={{ background: pkg.popular ? t.accent : t.accentFaded(0.1), color: pkg.popular ? "#000" : t.accent, border: `1px solid ${pkg.popular ? t.accent : t.accentFaded(0.3)}`, boxShadow: pkg.popular ? `0 0 16px ${t.accentFaded(0.3)}` : "none" }}>
                  <Coins className="w-3.5 h-3.5" /> Buy Coins
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom pack calculator */}
      <CustomPackCalculator
        country={selectedCountry}
        t={t}
        onBuy={(coins, bonus, label) => openModal(coins, bonus, label, Calculator as unknown as typeof Bot)}
      />

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
            Prices auto-converted from KES. 10 coins = 1 bot deployment. Payments secured by Paystack.
          </p>
        </div>
      </div>
    </div>
  );
}
