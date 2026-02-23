import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Plus, Trash2, Clock, CheckCircle, XCircle, Coins,
  AlertCircle, Gift, ExternalLink, ChevronDown, ChevronUp,
  Terminal, Code, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type BotRegistration = {
  id: string;
  userId: string;
  name: string;
  description: string;
  repository: string;
  logo: string | null;
  keywords: string[];
  category: string | null;
  env: Record<string, { description: string; required: boolean; placeholder?: string }>;
  status: string;
  rewardClaimed: boolean;
  rewardExpiresAt: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
};

type EnvVar = { key: string; description: string; required: boolean; placeholder: string };

export default function RegisterBot() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");
  const [logo, setLogo] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [category, setCategory] = useState("WhatsApp Bot");
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", description: "", required: true, placeholder: "" }]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: myBalance } = useQuery<{ balance: number }>({
    queryKey: [`/api/coins/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: registrations = [], isLoading } = useQuery<BotRegistration[]>({
    queryKey: ["/api/bot-registrations"],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiRequest("POST", "/api/bot-registrations", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot-registrations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/coins/${user?.id}`] });
      toast({ title: "Bot submitted!", description: "Your bot is under review. You'll earn 5 coins once approved." });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err?.message || "Submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/bot-registrations/${id}/redeem`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot-registrations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/coins/${user?.id}`] });
      toast({ title: "Reward claimed!", description: "5 coins added to your balance." });
    },
    onError: (err: any) => {
      toast({ title: "Claim failed", description: err?.message || "Failed to claim reward", variant: "destructive" });
    },
  });

  function resetForm() {
    setName(""); setDescription(""); setRepository(""); setLogo("");
    setKeywordInput(""); setKeywords([]); setCategory("WhatsApp Bot");
    setEnvVars([{ key: "", description: "", required: true, placeholder: "" }]);
    setFormStep(1);
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw) && keywords.length < 10) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  }

  function addEnvVar() {
    setEnvVars([...envVars, { key: "", description: "", required: true, placeholder: "" }]);
  }

  function removeEnvVar(i: number) {
    setEnvVars(envVars.filter((_, idx) => idx !== i));
  }

  function updateEnvVar(i: number, field: keyof EnvVar, value: string | boolean) {
    const next = [...envVars];
    next[i] = { ...next[i], [field]: value };
    setEnvVars(next);
  }

  function handleSubmit() {
    if (!name || !description || !repository) {
      toast({ title: "Missing fields", description: "Name, description, and repository are required.", variant: "destructive" });
      return;
    }

    const envMap: Record<string, { description: string; required: boolean; placeholder?: string }> = {};
    envVars.filter(e => e.key.trim()).forEach(e => {
      envMap[e.key.trim()] = { description: e.description, required: e.required, placeholder: e.placeholder || undefined };
    });

    submitMutation.mutate({ name, description, repository, logo: logo || undefined, keywords, category, env: envMap });
  }

  function getTimeLeft(expiresAt: string | null): string {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
  }

  const balance = myBalance?.balance ?? 0;
  const canAfford = balance >= 10;

  const statusColor: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#10b981",
    rejected: "#ef4444",
  };

  const statusIcon: Record<string, any> = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: t.accentFaded(0.12), border: `1px solid ${t.accentFaded(0.3)}` }}
          >
            <Package className="w-5 h-5" style={{ color: t.accent }} />
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-widest uppercase" style={{ color: t.accent }}>
              Register Your Bot
            </h1>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
              List your WhatsApp bot on WolfDeploy
            </p>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Coins, label: "Listing Fee", value: "10 Coins", desc: "One-time fee to submit for review" },
          { icon: Gift, label: "Reward", value: "5 Coins", desc: "Earned when your bot gets approved" },
          { icon: Clock, label: "Expiry", value: "7 Days", desc: "Claim your reward within 7 days of approval" },
        ].map(card => (
          <div
            key={card.label}
            className="p-4 rounded-xl"
            style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.12)}` }}
          >
            <card.icon className="w-5 h-5 mb-2" style={{ color: t.accent }} />
            <p className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{card.label}</p>
            <p className="text-lg font-display font-black" style={{ color: t.accent }}>{card.value}</p>
            <p className="text-[10px] text-gray-500 mt-1">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Balance + Submit button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4" style={{ color: t.accent }} />
          <span className="text-sm font-mono" style={{ color: t.accent }}>
            Balance: <strong>{balance}</strong> coins
          </span>
        </div>
        <Button
          data-testid="button-open-register-form"
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-xs tracking-widest uppercase"
          style={{ background: canAfford ? t.accent : "rgba(107,114,128,0.3)", color: canAfford ? "#000" : "#6b7280" }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Register Bot
        </Button>
      </div>

      {!canAfford && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl mb-6 text-xs font-mono"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          You need at least 10 coins to register a bot. Top up your balance in the Billing section.
        </div>
      )}

      {/* Registration Form */}
      {showForm && (
        <div
          className="rounded-2xl mb-8 overflow-hidden"
          style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.15)}` }}
        >
          {/* Step nav */}
          <div className="flex border-b" style={{ borderColor: t.accentFaded(0.1) }}>
            {[{ n: 1, label: "Bot Details" }, { n: 2, label: "Environment Vars" }].map(s => (
              <button
                key={s.n}
                data-testid={`tab-form-step-${s.n}`}
                onClick={() => setFormStep(s.n as 1 | 2)}
                className="flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-colors"
                style={{
                  color: formStep === s.n ? t.accent : "rgba(107,114,128,1)",
                  borderBottom: formStep === s.n ? `2px solid ${t.accent}` : "2px solid transparent",
                  background: formStep === s.n ? t.accentFaded(0.04) : "transparent",
                }}
              >
                Step {s.n}: {s.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {formStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Bot Name *</label>
                  <Input
                    data-testid="input-bot-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My Awesome WhatsApp Bot"
                    maxLength={100}
                    className="font-mono text-xs bg-transparent border-gray-700 focus:border-opacity-70"
                    style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Description *</label>
                  <Textarea
                    data-testid="input-bot-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what your bot does, its features, and use cases..."
                    maxLength={1000}
                    rows={4}
                    className="font-mono text-xs bg-transparent border-gray-700 resize-none"
                    style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                  />
                  <p className="text-[9px] text-gray-600 mt-1 font-mono">{description.length}/1000</p>
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Repository URL *</label>
                  <Input
                    data-testid="input-bot-repository"
                    value={repository}
                    onChange={e => setRepository(e.target.value)}
                    placeholder="https://github.com/you/your-bot"
                    className="font-mono text-xs bg-transparent"
                    style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Logo URL (optional)</label>
                  <Input
                    data-testid="input-bot-logo"
                    value={logo}
                    onChange={e => setLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="font-mono text-xs bg-transparent"
                    style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Category</label>
                  <select
                    data-testid="select-bot-category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                    style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.2)}`, color: "white" }}
                  >
                    {["WhatsApp Bot", "AI Bot", "Group Manager", "Entertainment", "Utility", "E-Commerce", "Education"].map(c => (
                      <option key={c} value={c} style={{ background: "#111" }}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Keywords (max 10)</label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-bot-keyword"
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                      placeholder="e.g. ai, sticker, games"
                      className="font-mono text-xs bg-transparent flex-1"
                      style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                    />
                    <Button
                      data-testid="button-add-keyword"
                      onClick={addKeyword}
                      size="sm"
                      variant="outline"
                      className="text-xs font-mono"
                      style={{ borderColor: t.accentFaded(0.2), color: t.accent }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {keywords.map(kw => (
                      <span
                        key={kw}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer"
                        style={{ background: t.accentFaded(0.1), border: `1px solid ${t.accentFaded(0.2)}`, color: t.accent }}
                        onClick={() => setKeywords(keywords.filter(k => k !== kw))}
                      >
                        {kw} <span className="opacity-60">×</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    data-testid="button-next-step"
                    onClick={() => setFormStep(2)}
                    className="font-mono text-xs tracking-widest uppercase"
                    style={{ background: t.accent, color: "#000" }}
                  >
                    Next: Env Vars →
                  </Button>
                </div>
              </div>
            )}

            {formStep === 2 && (
              <div className="space-y-4">
                <div
                  className="flex items-start gap-2 p-3 rounded-xl text-xs font-mono"
                  style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.1)}`, color: "rgba(156,163,175,1)" }}
                >
                  <Code className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
                  <span>Define the environment variables your bot requires. Users will fill these in when deploying.</span>
                </div>

                {envVars.map((ev, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl"
                    style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.1)}` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Variable #{i + 1}</span>
                      {envVars.length > 1 && (
                        <button onClick={() => removeEnvVar(i)} className="text-red-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 mb-1">Key (e.g. BOT_TOKEN)</label>
                        <Input
                          data-testid={`input-env-key-${i}`}
                          value={ev.key}
                          onChange={e => updateEnvVar(i, "key", e.target.value.toUpperCase().replace(/\s/g, "_"))}
                          placeholder="API_KEY"
                          className="font-mono text-xs bg-transparent"
                          style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 mb-1">Placeholder</label>
                        <Input
                          data-testid={`input-env-placeholder-${i}`}
                          value={ev.placeholder}
                          onChange={e => updateEnvVar(i, "placeholder", e.target.value)}
                          placeholder="your-api-key-here"
                          className="font-mono text-xs bg-transparent"
                          style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-[9px] font-mono text-gray-500 mb-1">Description</label>
                      <Input
                        data-testid={`input-env-desc-${i}`}
                        value={ev.description}
                        onChange={e => updateEnvVar(i, "description", e.target.value)}
                        placeholder="Your API key from the provider dashboard"
                        className="font-mono text-xs bg-transparent"
                        style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ev.required}
                        onChange={e => updateEnvVar(i, "required", e.target.checked)}
                        className="accent-green-500"
                      />
                      <span className="text-[10px] font-mono text-gray-400">Required field</span>
                    </label>
                  </div>
                ))}

                <button
                  data-testid="button-add-env-var"
                  onClick={addEnvVar}
                  className="w-full py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  style={{ border: `1px dashed ${t.accentFaded(0.25)}`, color: t.accentFaded(0.6) }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Variable
                </button>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    data-testid="button-prev-step"
                    onClick={() => setFormStep(1)}
                    variant="outline"
                    className="font-mono text-xs"
                    style={{ borderColor: t.accentFaded(0.2), color: "rgba(156,163,175,1)" }}
                  >
                    ← Back
                  </Button>
                  <Button
                    data-testid="button-submit-registration"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending || !canAfford}
                    className="font-mono text-xs tracking-widest uppercase"
                    style={{ background: t.accent, color: "#000" }}
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit for Review (10 coins)"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Registrations */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">My Submissions</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: t.accentFaded(0.05) }} />
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl"
            style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}` }}
          >
            <Bot className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: t.accent }} />
            <p className="text-xs font-mono text-gray-500">No submissions yet. Register your first bot above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map(reg => {
              const Icon = statusIcon[reg.status] || Clock;
              const color = statusColor[reg.status] || t.accent;
              const isExpanded = expandedId === reg.id;
              const timeLeft = getTimeLeft(reg.rewardExpiresAt);
              const canClaim = reg.status === "approved" && !reg.rewardClaimed && timeLeft !== "Expired" && timeLeft !== "";

              return (
                <div
                  key={reg.id}
                  data-testid={`card-registration-${reg.id}`}
                  className="rounded-xl overflow-hidden"
                  style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.12)}` }}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-bold text-white truncate">{reg.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-widest"
                        style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
                      >
                        {reg.status}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: t.accentFaded(0.08) }}>
                      <div className="pt-3 space-y-3">
                        <p className="text-xs text-gray-400 font-mono">{reg.description}</p>

                        <a
                          href={reg.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] font-mono hover:underline"
                          style={{ color: t.accent }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {reg.repository}
                        </a>

                        {reg.reviewNotes && (
                          <div
                            className="p-3 rounded-lg text-xs font-mono"
                            style={{ background: `${color}10`, border: `1px solid ${color}30`, color }}
                          >
                            <strong>Review note:</strong> {reg.reviewNotes}
                          </div>
                        )}

                        {reg.status === "approved" && (
                          <div
                            className="flex items-center justify-between p-3 rounded-xl"
                            style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.15)}` }}
                          >
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.accent }}>
                                5-Coin Reward
                              </p>
                              {reg.rewardClaimed ? (
                                <p className="text-[10px] text-gray-500 font-mono">Already claimed</p>
                              ) : (
                                <p className="text-[10px] text-gray-500 font-mono">{timeLeft || "Expires soon"}</p>
                              )}
                            </div>
                            {canClaim && (
                              <Button
                                data-testid={`button-claim-reward-${reg.id}`}
                                onClick={() => redeemMutation.mutate(reg.id)}
                                disabled={redeemMutation.isPending}
                                size="sm"
                                className="font-mono text-[10px] uppercase tracking-widest"
                                style={{ background: t.accent, color: "#000" }}
                              >
                                <Gift className="w-3 h-3 mr-1" />
                                Claim 5 Coins
                              </Button>
                            )}
                            {reg.rewardClaimed && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {timeLeft === "Expired" && !reg.rewardClaimed && (
                              <span className="text-[9px] font-mono text-red-500">Expired</span>
                            )}
                          </div>
                        )}
                      </div>
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
