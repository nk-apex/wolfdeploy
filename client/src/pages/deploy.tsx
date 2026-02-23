import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Bot, Deployment } from "@shared/schema";
import {
  Search, Rocket, ChevronRight, ArrowLeft, GitBranch,
  Star, Tag, ExternalLink, Lock, CheckCircle2, ArrowUpRight
} from "lucide-react";

type Step = "select" | "configure" | "deploying";

export default function Deploy() {
  const params = useParams<{ botId?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(params.botId ? "configure" : "select");
  const [selectedBotId, setSelectedBotId] = useState<string>(params.botId || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const { data: selectedBot } = useQuery<Bot>({
    queryKey: ["/api/bots", selectedBotId],
    queryFn: async () => {
      const res = await fetch(`/api/bots/${selectedBotId}`);
      return res.json();
    },
    enabled: !!selectedBotId,
  });

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/deploy", data);
      return res.json() as Promise<Deployment>;
    },
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      setStep("deploying");
      setTimeout(() => navigate(`/bots/${dep.id}/logs`), 2000);
    },
    onError: () => {
      toast({ title: "Deployment failed", description: "Could not start deployment.", variant: "destructive" });
    },
  });

  const filteredBots = bots.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectBot = (botId: string) => {
    setSelectedBotId(botId);
    setEnvVars({});
    setStep("configure");
  };

  const handleDeploy = () => {
    if (!selectedBot) return;
    const missing = Object.entries(selectedBot.env)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
      .filter(k => !envVars[k]?.trim());
    if (missing.length > 0) {
      toast({ title: "Missing required fields", description: `Fill in: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    deployMutation.mutate({ botId: selectedBotId, envVars });
  };

  if (step === "deploying") {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl border border-primary/30 bg-primary/10 mx-auto mb-6 flex items-center justify-center">
            <Rocket className="w-7 h-7 text-primary animate-bounce" />
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">Launching Bot</h2>
          <p className="text-sm text-gray-500 font-mono">Redirecting to deployment logs...</p>
          <div className="mt-6 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-start gap-3">
        {step === "configure" && (
          <button
            data-testid="button-back"
            onClick={() => setStep("select")}
            className="p-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all text-primary mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
            {step === "select" ? "Deploy a Bot" : "Configure Deployment"}
          </h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">
            {step === "select" ? "Choose from the bot catalog" : selectedBot?.name || "Set up your environment"}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-mono mb-4">
        <span className={step === "select" ? "text-primary" : "text-gray-600"}>1. Select Bot</span>
        <ChevronRight className="w-3 h-3 text-gray-700" />
        <span className={step === "configure" ? "text-primary" : "text-gray-600"}>2. Configure</span>
        <ChevronRight className="w-3 h-3 text-gray-700" />
        <span className="text-gray-700">3. Deploy</span>
      </div>

      {step === "select" && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <Input
              data-testid="input-search-bots"
              placeholder="Search bots by name, category..."
              className="pl-9 bg-black/30 border-primary/20 text-sm font-mono focus:border-primary/40 text-white placeholder:text-gray-700 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Bot Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-black/30 border border-primary/10 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredBots.map((bot) => (
                <button
                  key={bot.id}
                  data-testid={`bot-card-${bot.id}`}
                  onClick={() => handleSelectBot(bot.id)}
                  className="w-full text-left p-4 sm:p-5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm hover:border-primary/40 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span>{(bot.stars || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm font-display font-bold text-white mb-1">{bot.name}</p>
                  <p className="text-[11px] text-gray-500 font-mono line-clamp-2 mb-3">{bot.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {bot.category && (
                      <span className="flex items-center gap-1 text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-mono">
                        <Tag className="w-2.5 h-2.5" />
                        {bot.category}
                      </span>
                    )}
                    {bot.keywords.slice(0, 2).map(k => (
                      <span key={k} className="text-[9px] text-gray-600 bg-black/30 border border-primary/10 px-1.5 py-0.5 rounded font-mono">
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-primary/10 pt-2">
                    <span className="text-[9px] text-gray-600 font-mono">{Object.keys(bot.env).length} config vars</span>
                    <span className="text-[10px] text-primary font-mono group-hover:underline flex items-center gap-1">
                      Deploy <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && filteredBots.length === 0 && (
            <div className="text-center py-16">
              <GitBranch className="w-8 h-8 text-primary/30 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-mono">No bots found for "{searchQuery}"</p>
            </div>
          )}
        </>
      )}

      {step === "configure" && selectedBot && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Bot Info */}
          <div className="lg:col-span-1">
            <div className="p-4 sm:p-5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm space-y-4">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg w-fit">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-white text-sm sm:text-base">{selectedBot.name}</p>
                <p className="text-[11px] text-gray-500 font-mono mt-1 leading-relaxed">{selectedBot.description}</p>
              </div>
              {selectedBot.category && (
                <span className="inline-flex items-center gap-1 text-[9px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-mono">
                  <Tag className="w-2.5 h-2.5" />
                  {selectedBot.category}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-xs text-gray-500 font-mono">{(selectedBot.stars || 0).toLocaleString()} stars</span>
              </div>
              <a
                href={selectedBot.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-primary font-mono hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View Repository
              </a>
              <div className="pt-2 border-t border-primary/10">
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {selectedBot.keywords.map(k => (
                    <span key={k} className="text-[9px] text-gray-600 bg-black/20 border border-primary/10 px-1.5 py-0.5 rounded font-mono">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Config Form */}
          <div className="lg:col-span-2">
            <div className="p-4 sm:p-6 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5 font-mono">
                <Lock className="w-4 h-4 text-primary" />
                Environment Variables
              </h3>
              <div className="space-y-4">
                {Object.entries(selectedBot.env).map(([key, config]) => (
                  <div key={key}>
                    <label
                      htmlFor={`env-${key}`}
                      className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest font-mono mb-1.5"
                    >
                      {key}
                      {config.required && (
                        <span className="text-[8px] text-primary border border-primary/30 px-1 py-0.5 rounded font-mono">
                          REQUIRED
                        </span>
                      )}
                    </label>
                    <Input
                      id={`env-${key}`}
                      data-testid={`input-env-${key.toLowerCase()}`}
                      type={key.includes("KEY") || key.includes("SECRET") ? "password" : "text"}
                      placeholder={config.placeholder || config.description}
                      className="bg-black/50 border-primary/20 text-sm font-mono text-white placeholder:text-gray-700 focus:border-primary/40 rounded-lg"
                      value={envVars[key] || ""}
                      onChange={(e) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                    <p className="text-[10px] text-gray-600 font-mono mt-1">{config.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-primary/10 flex items-center justify-between gap-4">
                <div className="text-[10px] text-gray-600 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                  Includes SSL, auto-restart & monitoring
                </div>
                <button
                  data-testid="button-deploy"
                  onClick={handleDeploy}
                  disabled={deployMutation.isPending}
                  className="group px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-mono text-primary">
                    {deployMutation.isPending ? (
                      <>
                        <div className="w-3.5 h-3.5 border border-primary/50 border-t-primary rounded-full animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-3.5 h-3.5" />
                        Deploy Now
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
