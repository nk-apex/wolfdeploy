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

const KES_PER_COIN = 0.5; /* 100 coins = KES 50 (minimum purchase) */

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
  { id: "starter", coins: 100, days: 10, bonus: 0,  label: "Starter Pack", icon: Bot,  popular: false, tagline: "~1.5 weeks for 1 bot" },
  { id: "power",   coins: 250, days: 26, bonus: 25, label: "Power Pack",   icon: Zap,  popular: true,  tagline: "~3.5 weeks + 25 bonus coins" },
  { id: "ultra",   coins: 600, days: 63, bonus: 100,label: "Ultra Pack",   icon: Star, popular: false, tagline: "~9 weeks + 100 bonus coins" },
];

/* directCharge: true  = Paystack Charge API works (Ghana, Rwanda, Uganda)
   directCharge: false = Must use Paystack checkout form (Kenya M-PESA, etc.) */
type MobileProvider = { id: string; name: string; directCharge: boolean };
const COUNTRIES = [
  { code: "NG", name: "Nigeria",        currency: "NGN", symbol: "₦",    flag: "🇳🇬", dialCode: "234", methods: ["card", "bank_transfer", "ussd"], providers: [] as MobileProvider[] },
  { code: "GH", name: "Ghana",          currency: "GHS", symbol: "₵",    flag: "🇬🇭", dialCode: "233", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: true }, { id: "vodafone", name: "Vodafone", directCharge: true }, { id: "airteltigo", name: "AirtelTigo", directCharge: true }] },
  { code: "KE", name: "Kenya",          currency: "KES", symbol: "KSh",  flag: "🇰🇪", dialCode: "254", methods: ["card", "mobile_money"], providers: [{ id: "mpesa", name: "M-PESA", directCharge: true }] },
  { code: "ZA", name: "South Africa",   currency: "ZAR", symbol: "R",    flag: "🇿🇦", dialCode: "27",  methods: ["card"], providers: [] as MobileProvider[] },
  { code: "RW", name: "Rwanda",         currency: "RWF", symbol: "FRw",  flag: "🇷🇼", dialCode: "250", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: true }] },
  { code: "TZ", name: "Tanzania",       currency: "TZS", symbol: "TSh",  flag: "🇹🇿", dialCode: "255", methods: ["card", "mobile_money"], providers: [{ id: "mpesa", name: "M-PESA", directCharge: false }, { id: "tigopesa", name: "Tigo", directCharge: false }, { id: "airtel", name: "Airtel", directCharge: false }, { id: "halopesa", name: "Halotel", directCharge: false }] },
  { code: "UG", name: "Uganda",         currency: "UGX", symbol: "USh",  flag: "🇺🇬", dialCode: "256", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: true }, { id: "airtel", name: "Airtel", directCharge: true }] },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", symbol: "CFA",  flag: "🇨🇮", dialCode: "225", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: false }, { id: "moov", name: "Moov", directCharge: false }, { id: "wave", name: "Wave", directCharge: false }] },
  { code: "CM", name: "Cameroon",       currency: "XAF", symbol: "FCFA", flag: "🇨🇲", dialCode: "237", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: false }, { id: "orange", name: "Orange", directCharge: false }] },
  { code: "ZM", name: "Zambia",         currency: "ZMW", symbol: "ZK",   flag: "🇿🇲", dialCode: "260", methods: ["card", "mobile_money"], providers: [{ id: "mtn", name: "MTN", directCharge: false }, { id: "airtel", name: "Airtel", directCharge: false }, { id: "zamtel", name: "Zamtel", directCharge: false }] },
  { code: "EG", name: "Egypt",          currency: "EGP", symbol: "E£",   flag: "🇪🇬", dialCode: "20",  methods: ["card"], providers: [] as MobileProvider[] },
  { code: "ET", name: "Ethiopia",       currency: "ETB", symbol: "Br",   flag: "🇪🇹", dialCode: "251", methods: ["card"], providers: [] as MobileProvider[] },
  { code: "SN", name: "Senegal",        currency: "XOF", symbol: "CFA",  flag: "🇸🇳", dialCode: "221", methods: ["card", "mobile_money"], providers: [{ id: "wave", name: "Wave", directCharge: false }, { id: "orange", name: "Orange Money", directCharge: false }, { id: "free", name: "Free Money", directCharge: false }] },
  { code: "XX", name: "Others (USD)",   currency: "USD", symbol: "$",    flag: "🌐",  dialCode: "1",   methods: ["card"], providers: [] as MobileProvider[] },
];

const METHOD_META: Record<string, { label: string; desc: string; icon: typeof CreditCard }> = {
  card:          { label: "Card",          desc: "Visa / Mastercard",    icon: CreditCard },
  mobile_money:  { label: "Mobile Money",  desc: "MTN, M-Pesa & more",   icon: Smartphone },
  bank_transfer: { label: "Bank Transfer", desc: "Direct bank transfer", icon: Banknote },
  ussd:          { label: "USSD",          desc: "*737#, *919# & more",  icon: Smartphone },
};


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

function PaymentModal({ pkg, country, userEmail, userId, onClose, onSuccess, t }: ModalProps) {
  const [method, setMethod] = useState(country.methods[0]);
  const [provider, setProvider] = useState(country.providers[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [visible, setVisible] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);
  /* For card/USSD/bank — show Paystack iframe */
  const [paystackUrl, setPaystackUrl] = useState("");
  const [payRef, setPayRef] = useState("");
  const [verifying, setVerifying] = useState(false);
  /* For mobile money — show our own waiting screen + poll */
  const [stkSent, setStkSent] = useState(false);
  const [stkText, setStkText] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const isMobileMoney = method === "mobile_money";
  const selectedProvider = country.providers.find(p => p.id === provider);
  const useDirectCharge = isMobileMoney && (selectedProvider?.directCharge ?? false);
  const PkgIcon = pkg.icon;
  const price = coinsToPrice(pkg.coins, country.currency);
  const totalCoins = pkg.coins + pkg.bonus;
  const bots = Math.floor(totalCoins / 10);

  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  /* Reset provider when method changes */
  useEffect(() => {
    if (method === "mobile_money") {
      setProvider(country.providers[0]?.id ?? "");
    }
  }, [method]);

  /* Poll for STK push result every 4 seconds (mobile money only) */
  useEffect(() => {
    if (!stkSent || verifying || !payRef) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/payments/check/${payRef}`);
        const data = await res.json() as { status: string };
        if (data.status === "success") {
          doVerify(payRef);
        } else if (data.status === "failed" || data.status === "abandoned") {
          setStkSent(false);
          setPayRef("");
          setErrMsg("Payment was not completed. Please try again.");
        } else {
          /* still pending — increment to re-trigger effect */
          setPollCount(c => c + 1);
        }
      } catch {
        setPollCount(c => c + 1);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [stkSent, payRef, pollCount, verifying]);

  /* Listen for postMessage from Paystack iframe (card/USSD/bank) */
  useEffect(() => {
    if (!paystackUrl) return;
    function onMessage(e: MessageEvent) {
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.event === "successful" || d?.data?.event === "success" || d?.type === "paystack:payment:success") {
          doVerify(payRef);
        }
      } catch { /* ignore */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [paystackUrl, payRef]);

  function handleClose() {
    if (loading || paystackUrl || stkSent) return;
    setVisible(false);
    setTimeout(onClose, 220);
  }

  function cancelStk() {
    setStkSent(false);
    setPayRef("");
    setErrMsg("");
  }

  async function handlePay() {
    setErrMsg("");
    const digits = phone.replace(/\D/g, "");
    /* Paystack Charge API requires international format with + prefix: +2547XXXXXXXX */
    const intlPhone = `+${country.dialCode}${digits}`;
    const amountMinor = Math.round(price * 100);

    setLoading(true);
    try {
      if (useDirectCharge) {
        /* ── Paystack Charge API: directly triggers STK push (Ghana, Rwanda, Uganda) ── */
        const chargeRes = await fetch("/api/payments/mobile-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `${intlPhone.replace("+", "")}@wolfdeploy.app`,
            amount: amountMinor,
            currency: country.currency,
            phone: intlPhone,
            provider,
          }),
        });
        const chargeData = await chargeRes.json() as { reference?: string; status?: string; displayText?: string; error?: string };
        if (!chargeRes.ok || !chargeData.reference) {
          setErrMsg(chargeData.error || "Failed to initiate payment. Try again.");
          return;
        }
        setPayRef(chargeData.reference);
        setStkText(chargeData.displayText || "Enter your mobile money PIN on your phone");
        setStkSent(true);
        setPollCount(0);
      } else {
        /* ── Initialize + Paystack iframe (Kenya M-PESA, card, USSD, bank) ── */
        const ref = `WOLF-${Date.now()}-c${totalCoins}`;
        const initBody: Record<string, unknown> = {
          email: isMobileMoney ? `${localPhone}@wolfdeploy.app` : email,
          amount: amountMinor,
          currency: country.currency,
          channels: [method],
          reference: ref,
          userId,
          coins: totalCoins,
        };
        if (isMobileMoney) initBody.phone = intlPhone;
        const initRes = await fetch("/api/payments/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initBody),
        });
        const initData = await initRes.json() as { authorizationUrl?: string; error?: string };
        if (!initRes.ok || !initData.authorizationUrl) {
          setErrMsg(initData.error || "Failed to initialise payment. Try again.");
          return;
        }
        setPayRef(ref);
        setPaystackUrl(initData.authorizationUrl);
      }
    } catch {
      setErrMsg("Could not connect to payment server. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function doVerify(ref: string) {
    setVerifying(true);
    try {
      const verRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref, userId, coins: totalCoins }),
      });
      const verData = await verRes.json() as { success?: boolean; error?: string };
      if (verRes.ok && verData.success) {
        setStkSent(false);
        setPaystackUrl("");
        onSuccess(totalCoins, ref);
      } else {
        setVerifying(false);
        setStkSent(false);
        setPaystackUrl("");
        setErrMsg(verData.error || "Payment not confirmed yet. If charged, contact support.");
      }
    } catch {
      setVerifying(false);
      setStkSent(false);
      setPaystackUrl("");
      setErrMsg("Verification failed. Contact support if you were charged.");
    }
  }

  const canPay = isMobileMoney
    ? !!phone.trim() && !!provider
    : !!email.trim();

  /* ── Mobile money STK waiting screen ── */
  if (stkSent) {
    const fullPhone = `+${country.dialCode}${phone}`;
    return (
      <div className="fixed inset-0 flex items-center justify-center px-4 py-8"
        style={{ zIndex: 10000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: t.glassEffect ? "rgba(8,15,40,0.98)" : "#0a0a0a", border: `1px solid ${t.accentFaded(0.3)}`, boxShadow: `0 0 80px ${t.accentFaded(0.15)}` }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${t.accentFaded(0.12)}`, background: t.accentFaded(0.04) }}>
            <Smartphone className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>STK Push Sent</p>
              <p className="text-sm font-bold text-white font-mono">{fullPhone}</p>
            </div>
          </div>
          <div className="p-6 text-center">
            {verifying ? (
              <>
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: t.accentFaded(0.1), border: `1px solid ${t.accentFaded(0.3)}` }}>
                  <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: `${t.accentFaded(0.2)} ${t.accentFaded(0.2)} ${t.accentFaded(0.2)} ${t.accent}` }} />
                </div>
                <p className="text-white font-bold font-mono text-sm mb-1">Confirming payment…</p>
                <p className="text-xs font-mono" style={{ color: t.textMuted }}>Please wait</p>
              </>
            ) : (
              <>
                {/* Pulsing phone icon */}
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl animate-pulse"
                  style={{ background: t.accentFaded(0.08), border: `2px solid ${t.accentFaded(0.35)}`, boxShadow: `0 0 30px ${t.accentFaded(0.2)}` }}>
                  📲
                </div>
                <p className="text-white font-bold font-mono text-base mb-1">Check your phone</p>
                <p className="text-xs font-mono mb-1" style={{ color: t.textMuted }}>{stkText || "Enter your PIN to approve"}</p>
                <p className="text-xs font-mono mb-6 font-bold" style={{ color: t.accent }}>
                  {country.symbol}{price.toLocaleString()} {country.currency}
                </p>
                {/* Subtle polling indicator */}
                <div className="flex items-center justify-center gap-1.5 mb-6">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: t.accentFaded(0.5), animationDelay: `${i * 0.15}s` }} />
                  ))}
                  <span className="text-[10px] font-mono ml-1" style={{ color: t.textMuted }}>Waiting for approval</span>
                </div>
                <button
                  data-testid="button-cancel-payment"
                  onClick={cancelStk}
                  className="w-full py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.7)" }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Card / USSD / Bank / M-PESA — Paystack iframe overlay ── */
  if (paystackUrl) {
    const isMpesa = isMobileMoney && !useDirectCharge;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-2 py-4"
        style={{ zIndex: 10000, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-md flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "#fff", maxHeight: "calc(100vh - 32px)" }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: "#f8f8f8", borderBottom: "1px solid #e5e5e5" }}>
            <div>
              <span className="text-xs font-mono text-gray-500">Secure checkout · Paystack</span>
              {isMpesa && (
                <p className="text-[10px] text-green-600 font-mono mt-0.5">
                  📱 Your number is pre-filled — just tap Pay to send the STK push
                </p>
              )}
            </div>
            {!verifying && (
              <button data-testid="button-cancel-payment" onClick={() => { setPaystackUrl(""); setPayRef(""); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded flex-shrink-0 ml-2">
                Cancel
              </button>
            )}
          </div>
          {verifying ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-mono">Verifying payment…</p>
            </div>
          ) : (
            <>
              <iframe data-testid="paystack-iframe" src={paystackUrl}
                className="w-full flex-1 border-0" style={{ minHeight: "500px" }}
                allow="payment" title="Paystack Checkout" />
              <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: "#f8f8f8", borderTop: "1px solid #e5e5e5" }}>
                <button data-testid="button-confirm-payment" onClick={() => doVerify(payRef)}
                  className="flex-1 py-2 rounded-lg text-xs font-mono font-bold text-white transition-all"
                  style={{ background: t.accent }}>
                  I've completed payment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4 py-8"
      style={{ zIndex: 10000, background: visible ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0)", backdropFilter: visible ? "blur(6px)" : "blur(0px)", transition: "background 220ms ease, backdrop-filter 220ms ease" }}
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
              <p className="font-bold text-white text-sm">{pkg.label}</p>
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

          {/* Payment method */}
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

          {/* Provider — mobile money only, when country has multiple */}
          {isMobileMoney && country.providers.length > 1 && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>Network / Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {country.providers.map(p => (
                  <button
                    key={p.id}
                    data-testid={`button-provider-${p.id}`}
                    onClick={() => setProvider(p.id)}
                    className="py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all text-center"
                    style={{
                      background: provider === p.id ? t.accentFaded(0.15) : t.accentFaded(0.04),
                      border: `1px solid ${provider === p.id ? t.accent : t.accentFaded(0.15)}`,
                      color: provider === p.id ? t.accent : t.textMuted,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Phone — mobile money only */}
          {isMobileMoney && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>
                Phone number (STK push)
              </label>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${t.accentFaded(0.3)}`, background: t.accentFaded(0.08) }}>
                <span className="px-3 py-2.5 text-sm font-mono font-bold border-r whitespace-nowrap" style={{ color: t.accent, borderColor: t.accentFaded(0.2), background: t.accentFaded(0.05) }}>+{country.dialCode}</span>
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
                Enter your number without country code e.g. 712345678
              </p>
            </div>
          )}

          {/* Email — card / USSD / bank only */}
          {!isMobileMoney && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: t.textMuted }}>Billing email</label>
              <input data-testid="input-billing-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none transition-all"
                style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.2)}` }} />
            </div>
          )}

          {/* Error */}
          {errMsg && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-red-400">{errMsg}</p>
            </div>
          )}

          {/* Pay button */}
          <button
            data-testid="button-pay-now"
            disabled={!canPay || loading}
            onClick={handlePay}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all"
            style={{ background: t.accent, color: "#000", border: `1px solid ${t.accent}`, boxShadow: `0 0 24px ${t.accentFaded(0.35)}`, opacity: (canPay && !loading) ? 1 : 0.45 }}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Connecting…</>
            ) : useDirectCharge
              ? <><Smartphone className="w-4 h-4" /> Send STK Push · {country.symbol}{price.toLocaleString()}</>
              : isMobileMoney
              ? <><Smartphone className="w-4 h-4" /> Pay {country.symbol}{price.toLocaleString()} via {selectedProvider?.name}</>
              : <>Pay {country.symbol}{price.toLocaleString()} <ArrowRight className="w-4 h-4" /></>}
          </button>

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
    staleTime: 0,
    refetchInterval: 15000,
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
                  <span className="text-xs font-mono text-white">~<strong>{pkg.days}</strong> days runtime{pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ""}</span>
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
