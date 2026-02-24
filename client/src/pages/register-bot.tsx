import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Bot, Gift, Clock, CheckCircle, XCircle, AlertCircle,
  ExternalLink, ChevronDown, ChevronUp, Search, Loader2,
  Github, User, Link as LinkIcon, Tag, FileText, Package,
  Star, ShoppingCart,
} from "lucide-react";

type Plan = "trial" | "monthly";

const PLANS = {
  trial: {
    label: "Free Trial",
    coins: 5,
    days: 7,
    price: "Free",
    color: "rgba(74,222,128,0.12)",
    border: "rgba(74,222,128,0.4)",
    accent: "hsl(142 76% 42%)",
    note: "Bot auto-removed after 7 days",
    icon: Clock,
  },
  monthly: {
    label: "Monthly",
    coins: 100,
    days: 30,
    price: "50 KSH",
    color: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.4)",
    accent: "#fbbf24",
    note: "Bot stays live for 30 days",
    icon: Star,
  },
} as const;

type BotRegistration = {
  id: string;
  userId: string;
  developerName: string | null;
  pairSiteUrl: string | null;
  name: string;
  description: string;
  repository: string;
  logo: string | null;
  keywords: string[];
  category: string | null;
  env: Record<string, unknown>;
  status: string;
  rewardClaimed: boolean;
  rewardExpiresAt: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
};

export default function RegisterBot() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [developerName, setDeveloperName] = useState("");
  const [pairSiteUrl, setPairSiteUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");
  const [logo, setLogo] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [category, setCategory] = useState("WhatsApp Bot");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fetchingConfig, setFetchingConfig] = useState(false);

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/coins/${user!.id}`, {
        headers: { "x-user-id": user!.id },
      });
      return res.json();
    },
  });

  const { data: registrations = [], isLoading } = useQuery<BotRegistration[]>({
    queryKey: ["/api/bot-registrations"],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      apiRequest("POST", "/api/bot-registrations", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coins", user?.id] });
      const plan = selectedPlan ? PLANS[selectedPlan] : PLANS.monthly;
      toast({ title: "Bot submitted!", description: `Under review. Listed for ${plan.days} days on the ${plan.label} plan.` });
      setShowForm(false);
      setSelectedPlan(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("POST", `/api/bot-registrations/${id}/redeem`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coins", user?.id] });
      toast({ title: "Reward claimed! +5 coins added." });
    },
    onError: (err: any) => {
      toast({ title: "Claim failed", description: err?.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setDeveloperName(""); setPairSiteUrl(""); setName(""); setDescription("");
    setRepository(""); setLogo(""); setKeywordInput(""); setKeywords([]);
    setCategory("WhatsApp Bot");
  }

  async function fetchFromRepo() {
    if (!repository.trim()) {
      toast({ title: "Enter repo URL first", variant: "destructive" });
      return;
    }
    setFetchingConfig(true);
    try {
      const res = await fetch(`/api/bot-registrations/fetch-config?repo=${encodeURIComponent(repository.trim())}`, {
        headers: { "x-user-id": user?.id || "" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.found) {
        toast({ title: "No app.json found", description: "Fill in details manually." });
      } else {
        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);
        if (data.keywords?.length) setKeywords(data.keywords);
        if (data.logo) setLogo(data.logo);
        toast({ title: "Config loaded from repo!", description: "Review and fill in remaining fields." });
      }
    } catch (err: any) {
      toast({ title: "Fetch failed", description: err?.message, variant: "destructive" });
    } finally {
      setFetchingConfig(false);
    }
  }

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw) && keywords.length < 10) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  }

  function handleSubmit() {
    if (!name || !description || !repository || !developerName) {
      toast({ title: "Missing fields", description: "Developer name, bot name, description, and repository are required.", variant: "destructive" });
      return;
    }
    submitMutation.mutate({ name, description, repository, logo: logo || undefined, keywords, category, developerName, pairSiteUrl: pairSiteUrl || undefined, env: {}, plan: selectedPlan ?? "monthly" });
  }

  function getTimeLeft(expiresAt: string | null): string {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
  }

  const balance = coinData?.balance ?? 0;
  const canAffordTrial = balance >= 5;
  const canAffordMonthly = balance >= 100;
  const canAfford = canAffordTrial; // can afford at least the trial

  const STATUS_COLORS: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#4ade80",
    rejected: "#f87171",
  };

  const STATUS_ICONS: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
  };

  const inputStyle = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(74,222,128,0.2)",
    color: "white",
  };

  return (
    <div className="p-4 sm:p-6 min-h-full" data-testid="register-bot-page">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Register Your Bot</h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">
            Submit your WhatsApp bot to the WolfDeploy catalog
          </p>
        </div>
        <button
          data-testid="button-open-register-form"
          onClick={() => { setShowForm(v => !v); if (showForm) { setSelectedPlan(null); } }}
          className="px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all hover:opacity-90"
          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
        >
          {showForm ? "✕ Cancel" : "+ Register Bot"}
        </button>
      </div>

      {/* Plan selection — shown when form is open but no plan chosen yet */}
      {showForm && !selectedPlan && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 font-mono mb-4">Choose a listing plan to continue:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, plan]) => {
              const canAffordPlan = key === "trial" ? canAffordTrial : canAffordMonthly;
              const Icon = plan.icon;
              return (
                <button key={key} data-testid={`button-plan-${key}`}
                  onClick={() => canAffordPlan && setSelectedPlan(key)}
                  disabled={!canAffordPlan}
                  className="text-left rounded-2xl p-5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: plan.color, border: `1px solid ${plan.border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
                      <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.4)", color: plan.accent, border: `1px solid ${plan.border}` }}>
                      {plan.price}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm font-mono mb-1">{plan.label}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl font-bold font-mono" style={{ color: plan.accent }}>{plan.coins} coins</span>
                    <span className="text-xs text-gray-400 font-mono">· {plan.days} days</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">{plan.note}</p>
                  {!canAffordPlan && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400 mt-2">
                      <AlertCircle className="w-3 h-3" />
                      Need {plan.coins} coins —{" "}
                      <Link href="/billing" className="underline" onClick={e => e.stopPropagation()}>Buy coins</Link>
                    </div>
                  )}
                  {canAffordPlan && (
                    <div className="flex items-center gap-1 text-[10px] font-mono mt-2" style={{ color: plan.accent }}>
                      <CheckCircle className="w-3 h-3" /> Select this plan →
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {!canAffordTrial && (
            <div className="flex items-center gap-2 p-3 rounded-xl mt-4 text-xs font-mono max-w-2xl"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              You need at least 5 coins. <Link href="/billing" className="underline ml-1">Top up in Billing</Link>
            </div>
          )}
        </div>
      )}

      {/* Plan badge shown when plan is already selected */}
      {showForm && selectedPlan && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold"
            style={{ background: PLANS[selectedPlan].color, border: `1px solid ${PLANS[selectedPlan].border}`, color: PLANS[selectedPlan].accent }}>
            {selectedPlan === "trial" ? <Clock className="w-3 h-3" /> : <Star className="w-3 h-3" />}
            {PLANS[selectedPlan].label} · {PLANS[selectedPlan].coins} coins · {PLANS[selectedPlan].days} days
          </div>
          <button onClick={() => setSelectedPlan(null)}
            className="text-[10px] font-mono text-gray-500 hover:text-gray-300 underline">
            Change plan
          </button>
        </div>
      )}

      {/* Registration Form */}
      {showForm && selectedPlan && (
        <div
          className="rounded-xl mb-8 overflow-hidden"
          style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        >
          <div className="p-4 sm:p-6" style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
            <h2 className="font-bold text-white flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-primary" /> Bot Details
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-1">
              Enter your repository URL and click "Read from Repo" to auto-populate fields from app.json
            </p>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {/* Developer info row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                  <User className="w-3 h-3 inline mr-1" /> Developer Name *
                </label>
                <input
                  data-testid="input-developer-name"
                  type="text"
                  value={developerName}
                  onChange={e => setDeveloperName(e.target.value)}
                  placeholder="Your name or alias"
                  maxLength={100}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                  <LinkIcon className="w-3 h-3 inline mr-1" /> Bot Pair Site URL
                </label>
                <input
                  data-testid="input-pair-site-url"
                  type="url"
                  value={pairSiteUrl}
                  onChange={e => setPairSiteUrl(e.target.value)}
                  placeholder="https://yourpairsite.com"
                  maxLength={500}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Repo URL + auto-fetch */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                <Github className="w-3 h-3 inline mr-1" /> GitHub Repository URL *
              </label>
              <div className="flex gap-2">
                <input
                  data-testid="input-bot-repository"
                  type="url"
                  value={repository}
                  onChange={e => setRepository(e.target.value)}
                  placeholder="https://github.com/you/your-bot"
                  className="flex-1 px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
                <button
                  data-testid="button-fetch-from-repo"
                  onClick={fetchFromRepo}
                  disabled={fetchingConfig || !repository.trim()}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0"
                  style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "hsl(142 76% 42%)" }}
                >
                  {fetchingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Read Repo
                </button>
              </div>
              <p className="text-[9px] text-gray-600 font-mono mt-1">Automatically reads app.json from the repository to fill in details</p>
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">Bot Logo URL (optional)</label>
              <input
                data-testid="input-bot-logo"
                type="url"
                value={logo}
                onChange={e => setLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                style={inputStyle}
              />
            </div>

            {/* Bot name + category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                  <Bot className="w-3 h-3 inline mr-1" /> Bot Name *
                </label>
                <input
                  data-testid="input-bot-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="My Awesome Bot"
                  maxLength={100}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                  <Tag className="w-3 h-3 inline mr-1" /> Category
                </label>
                <select
                  data-testid="select-bot-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {["WhatsApp Bot", "AI Bot", "Group Manager", "Entertainment", "Utility", "E-Commerce", "Education"].map(c => (
                    <option key={c} value={c} style={{ background: "#111" }}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
                <FileText className="w-3 h-3 inline mr-1" /> Description *
              </label>
              <textarea
                data-testid="input-bot-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does your bot do? List its key features and use cases..."
                maxLength={1000}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none resize-none"
                style={inputStyle}
              />
              <p className="text-[9px] text-gray-600 font-mono text-right mt-0.5">{description.length}/1000</p>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">Keywords (max 10)</label>
              <div className="flex gap-2 mb-2">
                <input
                  data-testid="input-bot-keyword"
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder="e.g. ai, sticker, games"
                  className="flex-1 px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
                <button
                  data-testid="button-add-keyword"
                  onClick={addKeyword}
                  className="px-4 py-2.5 rounded-lg font-mono text-xs font-bold transition-all"
                  style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: "hsl(142 76% 42%)" }}
                >
                  Add
                </button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(kw => (
                    <span
                      key={kw}
                      onClick={() => setKeywords(keywords.filter(k => k !== kw))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: "hsl(142 76% 42%)" }}
                    >
                      {kw} <span className="opacity-60">×</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Config notice */}
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs font-mono"
              style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}
            >
              <Search className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <span className="text-gray-400">
                Environment variables are <strong className="text-primary">automatically determined</strong> from your repo's app.json — you don't need to define them manually.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2.5 rounded-lg font-mono text-xs transition-all"
                style={{ border: "1px solid rgba(74,222,128,0.15)", color: "#6b7280" }}
              >
                Cancel
              </button>
              <button
                data-testid="button-submit-registration"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
              >
                {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                {submitMutation.isPending ? "Submitting…" : "Submit for Review (100 coins)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Submissions */}
      <div>
        <h2 className="text-base sm:text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> My Submissions
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(74,222,128,0.05)" }} />
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div
            className="text-center py-14 rounded-xl"
            style={{ border: "1px dashed rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.2)" }}
          >
            <Bot className="w-9 h-9 mx-auto mb-3" style={{ color: "rgba(74,222,128,0.3)" }} />
            <p className="text-xs font-mono text-gray-500">No submissions yet</p>
            <p className="text-[10px] text-gray-700 font-mono mt-1">Register your first bot to get listed on WolfDeploy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map(reg => {
              const Icon = STATUS_ICONS[reg.status] || Clock;
              const color = STATUS_COLORS[reg.status] || "#4ade80";
              const isExpanded = expandedId === reg.id;
              const timeLeft = getTimeLeft(reg.rewardExpiresAt);
              const canClaim = reg.status === "approved" && !reg.rewardClaimed && timeLeft !== "Expired" && timeLeft !== "";

              return (
                <div
                  key={reg.id}
                  data-testid={`card-registration-${reg.id}`}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{reg.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ background: `${color}15`, color }}
                          >
                            {reg.status}
                          </span>
                          {reg.developerName && (
                            <span className="text-[9px] text-gray-600 font-mono">by {reg.developerName}</span>
                          )}
                          <span className="text-[9px] text-gray-700 font-mono">
                            {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {canClaim && (
                        <button
                          data-testid={`button-claim-reward-${reg.id}`}
                          onClick={e => { e.stopPropagation(); redeemMutation.mutate(reg.id); }}
                          disabled={redeemMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
                        >
                          <Gift className="w-3 h-3" />
                          Claim +5
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid rgba(74,222,128,0.08)" }}>
                      <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mb-1">Repository</p>
                          <a
                            href={reg.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-mono"
                          >
                            <Github className="w-3 h-3" />
                            {reg.repository.replace("https://github.com/", "")}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        {reg.pairSiteUrl && (
                          <div>
                            <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mb-1">Pair Site</p>
                            <a href={reg.pairSiteUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-primary hover:underline font-mono">
                              <LinkIcon className="w-3 h-3" />
                              {reg.pairSiteUrl.slice(0, 40)}{reg.pairSiteUrl.length > 40 ? "…" : ""}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mb-1">Description</p>
                        <p className="text-xs font-mono text-gray-400 leading-relaxed">{reg.description}</p>
                      </div>

                      {reg.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {reg.keywords.map(kw => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 rounded-full text-[9px] font-mono"
                              style={{ background: "rgba(74,222,128,0.08)", color: "hsl(142 76% 42%)", border: "1px solid rgba(74,222,128,0.15)" }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {reg.status === "approved" && (
                        <div className="p-3 rounded-xl" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)" }}>
                          {reg.rewardClaimed ? (
                            <p className="text-xs font-mono text-primary">✓ 5-coin reward claimed</p>
                          ) : timeLeft === "Expired" ? (
                            <p className="text-xs font-mono" style={{ color: "#f87171" }}>Reward expired</p>
                          ) : (
                            <p className="text-xs font-mono text-primary">Reward available — {timeLeft}</p>
                          )}
                        </div>
                      )}

                      {reg.reviewNotes && (
                        <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                          <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>Review Notes</p>
                          <p className="text-xs font-mono text-gray-400">{reg.reviewNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
