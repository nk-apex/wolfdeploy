import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Bot, Deployment } from "@shared/schema";
import {
  Search, Rocket, ChevronRight, ArrowLeft, GitBranch,
  Star, Tag, ExternalLink, Lock, CheckCircle2
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
  const [deploymentId, setDeploymentId] = useState<string>("");

  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const { data: selectedBot } = useQuery<Bot>({
    queryKey: ["/api/bots", selectedBotId],
    enabled: !!selectedBotId,
  });

  const deployMutation = useMutation({
    mutationFn: async (data: { botId: string; envVars: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/deploy", data);
      return res.json() as Promise<Deployment>;
    },
    onSuccess: (dep) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      setDeploymentId(dep.id);
      setStep("deploying");
      setTimeout(() => {
        navigate(`/bots/${dep.id}/logs`);
      }, 2500);
    },
    onError: () => {
      toast({ title: "Deployment failed", description: "Could not start deployment. Please try again.", variant: "destructive" });
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
    const requiredKeys = Object.entries(selectedBot.env)
      .filter(([, v]) => v.required)
      .map(([k]) => k);
    const missing = requiredKeys.filter(k => !envVars[k]?.trim());
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    deployMutation.mutate({ botId: selectedBotId, envVars });
  };

  if (step === "deploying") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full border-2 border-primary mx-auto mb-6 flex items-center justify-center terminal-glow">
            <Rocket className="w-7 h-7 text-primary animate-bounce" />
          </div>
          <h2 className="text-lg font-bold text-primary tracking-widest uppercase mb-2">Launching Bot</h2>
          <p className="text-sm text-muted-foreground tracking-wide">Redirecting to deployment logs...</p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === "configure" && (
          <button
            data-testid="button-back"
            onClick={() => setStep("select")}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground rounded border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-primary tracking-wider flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            {step === "select" ? "Deploy a Bot" : "Configure Deployment"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">
            {step === "select"
              ? "Choose a bot template from the catalog"
              : selectedBot?.name || "Configure your bot environment"}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase">
        <span className={step === "select" ? "text-primary" : "text-muted-foreground"}>
          1. Select Bot
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className={step === "configure" ? "text-primary" : "text-muted-foreground"}>
          2. Configure
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">3. Deploy</span>
      </div>

      {step === "select" && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-bots"
              placeholder="Search bots by name, category..."
              className="pl-9 bg-card border-card-border text-xs tracking-wide"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Bot Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBots.map((bot) => (
                <button
                  key={bot.id}
                  data-testid={`bot-card-${bot.id}`}
                  onClick={() => handleSelectBot(bot.id)}
                  className="text-left p-4 rounded-md border border-card-border bg-card hover-elevate cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span>{(bot.stars || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-foreground tracking-wide mb-1">{bot.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{bot.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {bot.category && (
                      <span className="flex items-center gap-1 text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded tracking-wider">
                        <Tag className="w-2.5 h-2.5" />
                        {bot.category}
                      </span>
                    )}
                    {bot.keywords.slice(0, 2).map(k => (
                      <span key={k} className="text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded tracking-wider">
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">
                      {Object.keys(bot.env).length} config vars
                    </span>
                    <span className="text-[10px] text-primary font-bold tracking-wider group-hover:underline">
                      Deploy &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && filteredBots.length === 0 && (
            <div className="text-center py-16">
              <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground tracking-wide">No bots found matching "{searchQuery}"</p>
            </div>
          )}
        </>
      )}

      {step === "configure" && selectedBot && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bot Info Card */}
          <div className="lg:col-span-1">
            <Card className="p-4 border-card-border bg-card space-y-4">
              <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground tracking-wide">{selectedBot.name}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{selectedBot.description}</p>
              </div>
              {selectedBot.category && (
                <span className="inline-flex items-center gap-1 text-[9px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded tracking-wider">
                  <Tag className="w-2.5 h-2.5" />
                  {selectedBot.category}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-xs text-muted-foreground">{(selectedBot.stars || 0).toLocaleString()} stars</span>
              </div>
              <a
                href={selectedBot.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-primary tracking-wider"
              >
                <ExternalLink className="w-3 h-3" />
                View Repository
              </a>
              <div className="pt-2 border-t border-border">
                <p className="text-[9px] text-muted-foreground tracking-widest uppercase mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {selectedBot.keywords.map(k => (
                    <span key={k} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Config Form */}
          <div className="lg:col-span-2">
            <Card className="p-5 border-card-border bg-card">
              <h3 className="text-xs font-bold text-foreground tracking-widest uppercase mb-4 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Environment Variables
              </h3>
              <div className="space-y-4">
                {Object.entries(selectedBot.env).map(([key, config]) => (
                  <div key={key}>
                    <label
                      htmlFor={`env-${key}`}
                      className="flex items-center gap-2 text-[10px] text-foreground tracking-widest uppercase font-bold mb-1.5"
                    >
                      {key}
                      {config.required && (
                        <span className="text-[8px] text-primary border border-primary/30 px-1 py-0.5 rounded tracking-wider">
                          REQUIRED
                        </span>
                      )}
                    </label>
                    <Input
                      id={`env-${key}`}
                      data-testid={`input-env-${key.toLowerCase()}`}
                      type={key.includes("KEY") || key.includes("SECRET") ? "password" : "text"}
                      placeholder={config.placeholder || config.description}
                      className="bg-background border-border text-xs font-mono tracking-wide"
                      value={envVars[key] || ""}
                      onChange={(e) => setEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 tracking-wide">{config.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-4">
                <div className="text-[10px] text-muted-foreground tracking-wide">
                  <CheckCircle2 className="w-3 h-3 text-primary inline mr-1" />
                  Deployment includes SSL, auto-restart, and uptime monitoring
                </div>
                <Button
                  data-testid="button-deploy"
                  onClick={handleDeploy}
                  disabled={deployMutation.isPending}
                  className="gap-2 tracking-widest text-[11px] uppercase"
                >
                  {deployMutation.isPending ? (
                    <>
                      <div className="w-3 h-3 border border-primary-foreground/50 border-t-primary-foreground rounded-full animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      Deploy Now
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
