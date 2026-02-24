import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Bot, Deployment } from "@shared/schema";
import {
  Rocket, ExternalLink, Lock, ArrowUpRight,
  ArrowLeft, Coins, ShoppingCart, AlertCircle, Shield,
  Loader2, Tag,
} from "lucide-react";

type EnvConfig = Record<string, { description: string; required: boolean; value?: string; placeholder?: string }>;

export default function Deploy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [launching, setLaunching] = useState(false);
  const [botAlias, setBotAlias] = useState("");
  const [liveEnv, setLiveEnv] = useState<EnvConfig | null>(null);
  const [liveEnvLoading, setLiveEnvLoading] = useState(false);
  const [livePairSiteUrl, setLivePairSiteUrl] = useState<string | null>(null);

  const { data: bots = [], isLoading } = useQuery<Bot[]>({ queryKey: ["/api/bots"] });

  const { data: adminData } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    staleTime: 0,
  });
  const isAdmin = adminData?.isAdmin ?? false;

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: async () => {
      const res = await fetch(`/api/coins/${user!.id}`);
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 10000,
  });

  const balance = coinData?.balance ?? 0;
  const canAfford = isAdmin || balance >= 100;

  useEffect(() => {
    if (!selectedBot) {
      setLiveEnv(null);
      setLivePairSiteUrl(null);
      return;
    }
    setLiveEnvLoading(true);
    fetch(`/api/bots/${selectedBot.id}/fetch-env`)
      .then(r => r.json())
      .then(data => {
        if (data.env) {
          setLiveEnv(data.env);
          if (data.pairSiteUrl) setLivePairSiteUrl(data.pairSiteUrl);
          const defaults: Record<string, string> = {};
          for (const [key, cfg] of Object.entries(data.env as EnvConfig)) {
            if (cfg.value) defaults[key] = cfg.value;
          }
          setEnvVars(defaults);
        } else {
          setLiveEnv(selectedBot.env as unknown as EnvConfig);
        }
      })
      .catch(() => {
        setLiveEnv(selectedBot.env as unknown as EnvConfig);
      })
      .finally(() => setLiveEnvLoading(false));
  }, [selectedBot]);

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string>; plan: string; botAlias?: string }) => {
      const res = await apiRequest("POST", "/api/deploy", { ...data, userId: user?.id });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Deployment failed");
      }
      return res.json() as Promise<Deployment>;
    },
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      queryClient.refetchQueries({ queryKey: ["/api/coins", user?.id] });
      setLaunching(true);
      setTimeout(() => navigate(`/bots/${dep.id}/logs`), 2200);
    },
    onError: (err: Error) => {
      toast({ title: "Deployment failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSelectBot = (bot: Bot) => {
    setSelectedBot(bot);
    setEnvVars({});
    setBotAlias("");
  };
  const handleBack = () => { setSelectedBot(null); };

  const activeEnv = liveEnv || (selectedBot?.env as unknown as EnvConfig) || {};
  const pairUrl = livePairSiteUrl || selectedBot?.pairSiteUrl;

  const handleDeploy = () => {
    if (!selectedBot) return;
    const missing = Object.entries(activeEnv)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
      .filter(k => !envVars[k]?.trim());
    if (missing.length > 0) {
      toast({ title: "Missing required fields", description: `Please fill in: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    deployMutation.mutate({ botId: selectedBot.id, envVars, plan: "monthly", botAlias: botAlias.trim() || undefined });
  };

  if (launching) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}>
            <Rocket className="w-9 h-9 text-primary animate-bounce" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Deploying…</h2>
          <p className="text-sm text-gray-500 font-mono mb-6">Setting up your bot, redirecting to logs</p>
          <div className="flex justify-center gap-1.5">
            {[0,1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
        </div>
      </div>
    );
  }

  const CoinStrip = () => isAdmin ? (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
      style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)" }}>
      <Shield className="w-4 h-4 text-primary flex-shrink-0" />
      <span className="text-sm font-mono font-bold text-primary">Admin — unlimited deployments, no coins required</span>
    </div>
  ) : (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-6"
      style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
      <div className="flex items-center gap-2.5">
        <Coins className="w-4 h-4 text-primary" />
        <span className="text-sm font-mono font-bold text-white">{balance} coins</span>
        <span className="text-[10px] font-mono text-gray-500">available</span>
      </div>
      <Link href="/billing">
        <button className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg font-bold"
          style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "hsl(142 76% 42%)" }}>
          <ShoppingCart className="w-3 h-3" /> Buy Coins
        </button>
      </Link>
    </div>
  );

  if (!selectedBot) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Choose a Bot to Deploy
          </h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">Select a WhatsApp bot template, configure it, and deploy instantly</p>
        </div>

        <CoinStrip />

        {!canAfford && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-xs font-mono"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>You need <strong>100 coins</strong> to deploy a bot. Your current balance is <strong>{balance} coins</strong>.</span>
            <Link href="/billing" className="ml-auto underline whitespace-nowrap font-bold" style={{ color: "#f87171" }}>Buy coins</Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bots.map((bot) => (
              <button key={bot.id} data-testid={`card-bot-${bot.id}`}
                onClick={() => { if (!canAfford) { toast({ title: "Insufficient coins", description: "You need 100 coins to deploy. Top up in Billing.", variant: "destructive" }); return; } handleSelectBot(bot); }}
                className="text-left group rounded-xl overflow-hidden transition-all flex flex-row sm:flex-col"
                style={{
                  border: `1px solid ${canAfford ? "rgba(74,222,128,0.2)" : "rgba(107,114,128,0.2)"}`,
                  background: "rgba(0,0,0,0.3)",
                  backdropFilter: "blur(8px)",
                  opacity: canAfford ? 1 : 0.55,
                  cursor: canAfford ? "pointer" : "not-allowed",
                }}>
                <div className="relative w-24 sm:w-full flex-shrink-0 h-auto sm:h-32 overflow-hidden border-r sm:border-r-0 sm:border-b" style={{ borderColor: "rgba(74,222,128,0.12)" }}>
                  <img src={bot.logo} alt={bot.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 min-h-full"
                    onError={e => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                      const el = img.parentElement!;
                      el.innerHTML = `<div style="width:100%;height:100%;min-height:80px;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.07)"><span style="color:hsl(142 76% 42%);font-size:26px;font-weight:900;">${bot.name[0]}</span></div>`;
                    }} />
                  <div className="absolute inset-0 sm:flex hidden" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
                  <div className="absolute bottom-2 left-2 hidden sm:block">
                    <span className="text-[8px] text-primary font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(74,222,128,0.3)" }}>{bot.category}</span>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-display font-bold text-white text-sm leading-tight">{bot.name}</h3>
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono leading-relaxed mb-2 line-clamp-2 flex-1">{bot.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {bot.keywords.slice(0, 3).map(k => (
                      <span key={k} className="text-[8px] text-gray-600 font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }}>{k}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(74,222,128,0.08)" }}>
                    <div className="flex items-center gap-1 text-[9px] font-mono" style={{ color: "rgba(74,222,128,0.6)" }}>
                      {isAdmin ? <><Shield className="w-2.5 h-2.5" /> Free (Admin)</> : <><Coins className="w-2.5 h-2.5" /> 100 coins · 30 days</>}
                    </div>
                    <div className="py-1 px-2.5 rounded-lg font-mono text-[9px] font-bold text-primary flex items-center gap-1" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}>
                      <Rocket className="w-2.5 h-2.5" /> Deploy
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8 flex items-center gap-3">
        <button data-testid="button-back-to-catalog" onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 font-mono hover:text-gray-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-gray-700 font-mono">/</span>
        <span className="text-xs text-primary font-mono">{selectedBot.name}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" /> Configure Deployment
        </h1>
        <p className="text-gray-400 font-mono text-xs sm:text-sm">Fill in the environment variables then deploy</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}>
            <div className="relative w-full h-36 overflow-hidden" style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
              <img src={selectedBot.logo} alt={selectedBot.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
              <div className="absolute bottom-2 left-3">
                <span className="text-[9px] text-primary font-mono px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(74,222,128,0.3)" }}>{selectedBot.category}</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <p className="font-display font-bold text-white text-sm sm:text-base">{selectedBot.name}</p>
                <p className="text-[11px] text-gray-400 font-mono leading-relaxed mt-1">{selectedBot.description}</p>
              </div>
              {pairUrl && (
                <a href={pairUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-mono hover:underline rounded-lg px-2.5 py-1.5"
                  style={{ color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span>Generate Session ID</span>
                </a>
              )}
              <div style={{ borderTop: "1px solid rgba(74,222,128,0.1)", paddingTop: "12px" }}>
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-2">Required Config</p>
                {liveEnvLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    <span className="text-[10px] text-gray-500 font-mono">Fetching from repository...</span>
                  </div>
                ) : (
                  Object.entries(activeEnv).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-[10px] text-gray-300 font-mono flex-1">{key}</span>
                      {cfg.required && <span className="text-[8px] text-primary font-mono" style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 4px", borderRadius: "3px" }}>REQUIRED</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="p-4 sm:p-6 rounded-2xl" style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}>
            <div className="mb-5">
              <label htmlFor="bot-alias" className="flex items-center gap-2 text-[10px] text-gray-300 uppercase tracking-widest font-mono mb-2 font-bold">
                <Tag className="w-3 h-3 text-primary" /> Bot Identity
                <span className="text-[8px] text-gray-600 font-mono normal-case tracking-normal">(optional)</span>
              </label>
              <Input id="bot-alias" data-testid="input-bot-alias"
                placeholder={`e.g. BOT-1, My ${selectedBot.name}, etc.`}
                className="font-mono text-sm text-white placeholder:text-gray-700 rounded-xl"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                maxLength={30}
                value={botAlias}
                onChange={e => setBotAlias(e.target.value)} />
              <p className="text-[10px] text-gray-600 font-mono mt-1">Give your bot a custom name to identify it (defaults to {selectedBot.name})</p>
            </div>

            <div style={{ borderTop: "1px solid rgba(74,222,128,0.1)", paddingTop: "16px" }}>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5 font-mono">
                <Lock className="w-4 h-4 text-primary" /> Environment Variables
              </h3>

              {liveEnvLoading ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-gray-400 font-mono">Reading app.json from repository...</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(activeEnv).map(([key, config]) => (
                    <div key={key}>
                      <label htmlFor={`env-${key}`} className="flex items-center gap-2 text-[10px] text-gray-300 uppercase tracking-widest font-mono mb-2 font-bold">
                        {key}
                        {config.required && <span className="text-[8px] text-primary font-mono normal-case tracking-normal" style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 5px", borderRadius: "3px" }}>REQUIRED</span>}
                      </label>
                      <Input id={`env-${key}`} data-testid={`input-env-${key.toLowerCase()}`}
                        type={key.includes("KEY") || key.includes("SECRET") || key.includes("TOKEN") ? "password" : "text"}
                        placeholder={config.placeholder || config.description}
                        className="font-mono text-sm text-white placeholder:text-gray-700 rounded-xl"
                        style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                        value={envVars[key] || ""}
                        onChange={e => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))} />
                      <p className="text-[10px] text-gray-600 font-mono mt-1">{config.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              {!isAdmin && !canAfford && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-xs font-mono"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Not enough coins. You have <strong className="mx-1">{balance}</strong> but need <strong className="mx-1">100</strong>.{" "}
                  <Link href="/billing" className="underline font-bold ml-auto" style={{ color: "#f87171" }}>Buy coins</Link>
                </div>
              )}
              <button data-testid="button-deploy" onClick={handleDeploy}
                disabled={deployMutation.isPending || !canAfford || liveEnvLoading}
                className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: "rgba(74,222,128,0.15)",
                  border: "1px solid rgba(74,222,128,0.4)",
                }}>
                {deployMutation.isPending ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /><span className="text-primary">Deploying…</span></>
                ) : isAdmin ? (
                  <><Shield className="w-4 h-4 text-primary" /><span className="text-primary">Admin Deploy — Free</span><ArrowUpRight className="w-4 h-4 text-primary" /></>
                ) : (
                  <><Rocket className="w-4 h-4 text-primary" /><span className="text-primary">Deploy — 100 coins · 30 days</span><ArrowUpRight className="w-4 h-4 text-primary" /></>
                )}
              </button>
              {!isAdmin && canAfford && (
                <p className="text-[10px] text-gray-600 font-mono text-center mt-2">
                  Balance after deploy: <span className="text-primary">{balance - 100} coins</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
