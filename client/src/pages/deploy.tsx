import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Bot, Deployment } from "@shared/schema";
import {
  Rocket, ExternalLink, Lock, CheckCircle2, ArrowUpRight,
  Bot as BotIcon, ArrowLeft, Coins, AlertCircle, ShoppingCart,
} from "lucide-react";

/* Coins are deducted over time: 1 coin per bot per 2.5h → 100 coins ≈ 1.5 weeks */
const MIN_COINS = 1;

export default function Deploy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [launching, setLaunching] = useState(false);

  const { data: bots = [], isLoading } = useQuery<Bot[]>({ queryKey: ["/api/bots"] });

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/coins/${user!.id}`);
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 10000,
  });

  const balance = coinData?.balance ?? 0;
  const hasCoins = balance >= MIN_COINS;

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string> }) => {
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
      if (err.message === "Insufficient coins") {
        toast({ title: "Not enough coins", description: "You need at least 1 coin to deploy a bot. Buy coins on the Billing page.", variant: "destructive" });
      } else {
        toast({ title: "Deployment failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const handleSelectBot = (bot: Bot) => { setSelectedBot(bot); setEnvVars({}); };
  const handleBack = () => { setSelectedBot(null); setEnvVars({}); };

  const handleDeploy = () => {
    if (!selectedBot) return;
    if (!hasCoins) {
      toast({ title: "Insufficient coins", description: `You need at least 1 coin to deploy. Current balance: ${balance}.`, variant: "destructive" });
      return;
    }
    const missing = Object.entries(selectedBot.env)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
      .filter(k => !envVars[k]?.trim());
    if (missing.length > 0) {
      toast({ title: "Missing required fields", description: `Please fill in: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    deployMutation.mutate({ botId: selectedBot.id, envVars });
  };

  /* ── Launching overlay ── */
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

  /* ── Coin balance strip (shown on both steps) ── */
  const CoinStrip = () => (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl mb-6"
      style={{ background: hasCoins ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${hasCoins ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}` }}
    >
      <div className="flex items-center gap-2.5">
        <Coins className="w-4 h-4" style={{ color: hasCoins ? "hsl(142 76% 42%)" : "#ef4444" }} />
        <div>
          <span className="text-sm font-mono font-bold text-white">{balance} coins</span>
          <span className="text-[10px] font-mono ml-2" style={{ color: hasCoins ? "rgba(74,222,128,0.7)" : "#f97316" }}>
            {hasCoins ? `${Math.max(1, Math.floor(balance / 100))} bot${Math.max(1, Math.floor(balance / 100)) > 1 ? "s" : ""} available` : "— top up to deploy"}
          </span>
        </div>
      </div>
      {!hasCoins && (
        <Link href="/billing">
          <button className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg font-bold transition-all"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "hsl(142 76% 42%)" }}>
            <ShoppingCart className="w-3 h-3" /> Buy Coins
          </button>
        </Link>
      )}
    </div>
  );

  /* ── Step 1: Bot catalog ── */
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

        {/* Insufficient coins wall */}
        {!hasCoins && (
          <div className="rounded-2xl p-8 text-center mb-6" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-base mb-2 font-mono">Insufficient Coins</h3>
            <p className="text-gray-400 text-xs font-mono mb-5 max-w-xs mx-auto">
              You need at least <strong className="text-white">1 coin</strong> to deploy a bot. Your current balance is <strong className="text-white">{balance} coins</strong>.
            </p>
            <Link href="/billing">
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-sm transition-all"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}>
                <ShoppingCart className="w-4 h-4" /> Buy Coins
              </button>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }} />)}
          </div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${!hasCoins ? "opacity-40 pointer-events-none select-none" : ""}`}>
            {bots.map((bot) => (
              <button key={bot.id} data-testid={`card-bot-${bot.id}`} onClick={() => hasCoins && handleSelectBot(bot)}
                className="text-left group rounded-xl overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-row sm:flex-col"
                style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}>
                {/* Image — horizontal on mobile, stacked on sm+ */}
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
                {/* Content */}
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
                      <Coins className="w-2.5 h-2.5" /> time-based
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

  /* ── Step 2: Configure ── */
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
        <p className="text-gray-400 font-mono text-xs sm:text-sm">Fill in the environment variables then click Deploy</p>
      </div>

      <CoinStrip />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left — Bot info */}
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
              <a href={selectedBot.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] text-primary font-mono hover:underline">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{selectedBot.repository.replace("https://", "")}</span>
              </a>
              {selectedBot.pairSiteUrl && (
                <a href={selectedBot.pairSiteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-mono hover:underline rounded-lg px-2.5 py-1.5"
                  style={{ color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span>Generate Session ID</span>
                </a>
              )}
              <div style={{ borderTop: "1px solid rgba(74,222,128,0.1)", paddingTop: "12px" }}>
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-2">Required Config</p>
                {Object.entries(selectedBot.env).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-[10px] text-gray-300 font-mono flex-1">{key}</span>
                    {cfg.required && <span className="text-[8px] text-primary font-mono" style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 4px", borderRadius: "3px" }}>REQUIRED</span>}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: "8px", padding: "6px 10px" }}>
                <Coins className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="text-gray-400">Balance: <strong className="text-primary">{balance} coins</strong> · auto-billed while running</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Config form */}
        <div className="lg:col-span-3">
          <div className="p-4 sm:p-6 rounded-2xl" style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5 font-mono">
              <Lock className="w-4 h-4 text-primary" /> Environment Variables
            </h3>
            <div className="space-y-5">
              {Object.entries(selectedBot.env).map(([key, config]) => (
                <div key={key}>
                  <label htmlFor={`env-${key}`} className="flex items-center gap-2 text-[10px] text-gray-300 uppercase tracking-widest font-mono mb-2 font-bold">
                    {key}
                    {config.required && <span className="text-[8px] text-primary font-mono normal-case tracking-normal" style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 5px", borderRadius: "3px" }}>REQUIRED</span>}
                  </label>
                  <Input id={`env-${key}`} data-testid={`input-env-${key.toLowerCase()}`}
                    type={key.includes("KEY") || key.includes("SECRET") ? "password" : "text"}
                    placeholder={config.placeholder || config.description}
                    className="font-mono text-sm text-white placeholder:text-gray-700 rounded-xl"
                    style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
                    value={envVars[key] || ""}
                    onChange={e => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))} />
                  <p className="text-[10px] text-gray-600 font-mono mt-1">{config.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button data-testid="button-deploy" onClick={handleDeploy} disabled={deployMutation.isPending || !hasCoins}
                className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)" }}>
                {deployMutation.isPending ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /><span className="text-primary">Deploying…</span></>
                ) : (
                  <><Rocket className="w-4 h-4 text-primary" /><span className="text-primary">Deploy Bot</span><ArrowUpRight className="w-4 h-4 text-primary" /></>
                )}
              </button>
              {!hasCoins && (
                <p className="text-[10px] text-red-400 font-mono text-center mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Insufficient coins — <Link href="/billing" className="underline">buy more</Link>
                </p>
              )}
              {hasCoins && (
                <p className="text-[10px] text-gray-600 font-mono text-center mt-2">
                  Auto-billed while running · Balance: <span className="text-primary">{balance} coins</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
