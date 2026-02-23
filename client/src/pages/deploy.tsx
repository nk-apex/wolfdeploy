import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Bot, Deployment } from "@shared/schema";
import {
  Rocket, ExternalLink, Lock, CheckCircle2, ArrowUpRight,
  Bot as BotIcon, ArrowLeft, Check,
} from "lucide-react";

export default function Deploy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [launching, setLaunching] = useState(false);

  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/deploy", data);
      return res.json() as Promise<Deployment>;
    },
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      setLaunching(true);
      setTimeout(() => navigate(`/bots/${dep.id}/logs`), 2200);
    },
    onError: () => {
      toast({ title: "Deployment failed", description: "Could not start deployment.", variant: "destructive" });
    },
  });

  const handleSelectBot = (bot: Bot) => {
    setSelectedBot(bot);
    setEnvVars({});
  };

  const handleBack = () => {
    setSelectedBot(null);
    setEnvVars({});
  };

  const handleDeploy = () => {
    if (!selectedBot) return;
    const missing = Object.entries(selectedBot.env)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
      .filter(k => !envVars[k]?.trim());
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    deployMutation.mutate({ botId: selectedBot.id, envVars });
  };

  /* ── Launching overlay ── */
  if (launching) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
          >
            <Rocket className="w-9 h-9 text-primary animate-bounce" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Deploying…</h2>
          <p className="text-sm text-gray-500 font-mono mb-6">Setting up your bot, redirecting to logs</p>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 1: Bot catalog ── */
  if (!selectedBot) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            Choose a Bot to Deploy
          </h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">
            Select a WhatsApp bot template, configure it, and deploy instantly
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-72 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {bots.map((bot) => (
              <button
                key={bot.id}
                data-testid={`card-bot-${bot.id}`}
                onClick={() => handleSelectBot(bot)}
                className="text-left group rounded-2xl overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
              >
                {/* Card image from GitHub user profile */}
                <div
                  className="relative w-full h-44 overflow-hidden"
                  style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}
                >
                  <img
                    src={bot.logo}
                    alt={bot.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)" }} />
                  <div className="absolute bottom-3 left-3">
                    <span
                      className="text-[9px] text-primary font-mono px-2 py-0.5 rounded"
                      style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(74,222,128,0.3)" }}
                    >
                      {bot.category}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-display font-bold text-white text-base sm:text-lg leading-tight">{bot.name}</h3>
                    <ArrowUpRight className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-400 font-mono leading-relaxed mb-4 line-clamp-3">
                    {bot.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {bot.keywords.slice(0, 4).map(k => (
                      <span
                        key={k}
                        className="text-[9px] text-gray-600 font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono mb-4 truncate"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{bot.repository.replace("https://github.com/", "")}</span>
                  </div>
                  <div
                    className="w-full py-2.5 rounded-xl text-center font-mono text-xs font-bold text-primary transition-all group-hover:opacity-90 flex items-center justify-center gap-2"
                    style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Deploy {bot.name}
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
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-center gap-3">
        <button
          data-testid="button-back-to-catalog"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 font-mono hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-gray-700 font-mono">/</span>
        <span className="text-xs text-primary font-mono">{selectedBot.name}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Configure Deployment
        </h1>
        <p className="text-gray-400 font-mono text-xs sm:text-sm">
          Fill in the environment variables then click Deploy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left — Bot info */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
          >
            {/* Image */}
            <div className="relative w-full h-36 overflow-hidden" style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
              <img
                src={selectedBot.logo}
                alt={selectedBot.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
              <div className="absolute bottom-2 left-3">
                <span
                  className="text-[9px] text-primary font-mono px-2 py-0.5 rounded"
                  style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(74,222,128,0.3)" }}
                >
                  {selectedBot.category}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <p className="font-display font-bold text-white text-sm sm:text-base">{selectedBot.name}</p>
                <p className="text-[11px] text-gray-400 font-mono leading-relaxed mt-1">{selectedBot.description}</p>
              </div>

              <a
                href={selectedBot.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-primary font-mono hover:underline"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{selectedBot.repository.replace("https://", "")}</span>
              </a>

              <div style={{ borderTop: "1px solid rgba(74,222,128,0.1)", paddingTop: "12px" }}>
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-2">Required Config</p>
                {Object.entries(selectedBot.env).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-[10px] text-gray-300 font-mono flex-1">{key}</span>
                    {cfg.required && (
                      <span
                        className="text-[8px] text-primary font-mono"
                        style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 4px", borderRadius: "3px" }}
                      >
                        REQUIRED
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                SSL, auto-restart, uptime monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Right — Config form */}
        <div className="lg:col-span-3">
          <div
            className="p-4 sm:p-6 rounded-2xl"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5 font-mono">
              <Lock className="w-4 h-4 text-primary" />
              Environment Variables
            </h3>

            <div className="space-y-5">
              {Object.entries(selectedBot.env).map(([key, config]) => (
                <div key={key}>
                  <label
                    htmlFor={`env-${key}`}
                    className="flex items-center gap-2 text-[10px] text-gray-300 uppercase tracking-widest font-mono mb-2 font-bold"
                  >
                    {key}
                    {config.required && (
                      <span
                        className="text-[8px] text-primary font-mono normal-case tracking-normal"
                        style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 5px", borderRadius: "3px" }}
                      >
                        REQUIRED
                      </span>
                    )}
                  </label>
                  <Input
                    id={`env-${key}`}
                    data-testid={`input-env-${key.toLowerCase()}`}
                    type={key.includes("KEY") || key.includes("SECRET") ? "password" : "text"}
                    placeholder={config.placeholder || config.description}
                    className="font-mono text-sm text-white placeholder:text-gray-700 rounded-xl"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(74,222,128,0.2)",
                    }}
                    value={envVars[key] || ""}
                    onChange={(e) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                  <p className="text-[10px] text-gray-600 font-mono mt-1">{config.description}</p>
                </div>
              ))}
            </div>

            {/* Deploy Button */}
            <div className="mt-6">
              <button
                data-testid="button-deploy"
                onClick={handleDeploy}
                disabled={deployMutation.isPending}
                className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)" }}
              >
                {deployMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    <span className="text-primary">Deploying…</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 text-primary" />
                    <span className="text-primary">Deploy to BotForge</span>
                    <ArrowUpRight className="w-4 h-4 text-primary" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-600 font-mono text-center mt-2">
                Your bot will be live within ~15 seconds
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
