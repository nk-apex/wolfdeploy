import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Bot, Deployment } from "@shared/schema";
import {
  Rocket, GitBranch, Star, ExternalLink, Lock,
  CheckCircle2, ArrowUpRight, Check, Bot as BotIcon
} from "lucide-react";

export default function Deploy() {
  const params = useParams<{ botId?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState(false);

  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const bot = bots[0];

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/deploy", data);
      return res.json() as Promise<Deployment>;
    },
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      setDeploying(true);
      setTimeout(() => navigate(`/bots/${dep.id}/logs`), 2200);
    },
    onError: () => {
      toast({ title: "Deployment failed", description: "Could not start deployment.", variant: "destructive" });
    },
  });

  const handleDeploy = () => {
    if (!bot) return;
    const missing = Object.entries(bot.env)
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
    deployMutation.mutate({ botId: bot.id, envVars });
  };

  if (deploying) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
          >
            <Rocket className="w-9 h-9 text-primary animate-bounce" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Deploying...</h2>
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

  if (isLoading || !bot) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-96 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Deploy to BotForge
        </h1>
        <p className="text-gray-400 font-mono text-xs sm:text-sm">
          Configure and launch your WhatsApp bot in seconds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left — Bot info */}
        <div className="lg:col-span-2">
          <div
            className="p-4 sm:p-5 rounded-xl space-y-4"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
          >
            {/* Logo + name */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
                <BotIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-white text-sm sm:text-base">{bot.name}</p>
                <span
                  className="text-[9px] text-primary font-mono"
                  style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "1px 6px", borderRadius: "4px" }}
                >
                  {bot.category}
                </span>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-gray-400 font-mono leading-relaxed">{bot.description}</p>

            <div className="flex flex-wrap gap-1.5">
              {bot.keywords.map(k => (
                <span
                  key={k}
                  className="text-[9px] text-gray-600 font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(74,222,128,0.1)" }}
                >
                  {k}
                </span>
              ))}
            </div>

            <a
              href={bot.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-primary font-mono hover:underline"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{bot.repository.replace("https://", "")}</span>
            </a>

            <div className="pt-2" style={{ borderTop: "1px solid rgba(74,222,128,0.1)" }}>
              <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-2">Required Config</p>
              {Object.entries(bot.env).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 py-1.5">
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
              Includes SSL, auto-restart, uptime monitoring
            </div>
          </div>
        </div>

        {/* Right — Config form */}
        <div className="lg:col-span-3">
          <div
            className="p-4 sm:p-6 rounded-xl"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5 font-mono">
              <Lock className="w-4 h-4 text-primary" />
              Environment Variables
            </h3>

            <div className="space-y-5">
              {Object.entries(bot.env).map(([key, config]) => (
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
                    className="font-mono text-sm text-white placeholder:text-gray-700 rounded-lg"
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
                    <div
                      className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
                    />
                    <span className="text-primary">Deploying...</span>
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
