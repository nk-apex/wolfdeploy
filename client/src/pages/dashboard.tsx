import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deployment, Bot } from "@shared/schema";
import {
  Rocket, Bot as BotIcon, Activity, Zap, Plus, ArrowUpRight,
  Server, TrendingUp, GitBranch, Shield, Crown
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

const PLANS = [
  {
    name: "Starter",
    icon: Zap,
    price: "$5.00",
    period: "/bot/mo",
    features: ["1 Bot Instance", "512MB RAM", "Shared CPU", "Community Support"],
    highlight: false,
    tag: null,
  },
  {
    name: "Pro",
    icon: Shield,
    price: "$15.00",
    period: "/bot/mo",
    features: ["Unlimited Bots", "2GB RAM", "Dedicated CPU", "Priority Support"],
    highlight: true,
    tag: "POPULAR",
  },
  {
    name: "Enterprise",
    icon: Crown,
    price: "$49.00",
    period: "/bot/mo",
    features: ["Unlimited Bots", "8GB RAM", "Dedicated Server", "24/7 Support"],
    highlight: false,
    tag: null,
  },
];

export default function Dashboard() {
  const { data: deployments = [], isLoading: depLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    refetchInterval: 4000,
  });
  const { data: bots = [], isLoading: botsLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const running = deployments.filter(d => d.status === "running").length;
  const stopped = deployments.filter(d => d.status === "stopped").length;
  const failed = deployments.filter(d => d.status === "failed").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-wider flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Welcome back, user</p>
        </div>
        <Link href="/deploy">
          <Button data-testid="button-deploy-server" className="gap-2 tracking-wider text-xs">
            <Plus className="w-4 h-4" />
            Deploy Bot
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "ACTIVE BOTS",
            value: depLoading ? null : running,
            sub: running === 0 ? "No bots deployed yet" : `${running} bot${running !== 1 ? "s" : ""} running`,
            icon: BotIcon,
            testId: "stat-active-bots",
          },
          {
            label: "AVAILABLE BOTS",
            value: botsLoading ? null : bots.length,
            sub: "Ready to deploy",
            icon: GitBranch,
            testId: "stat-available-bots",
          },
          {
            label: "TOTAL DEPLOYED",
            value: depLoading ? null : deployments.length,
            sub: `${failed > 0 ? failed + " failed" : "0 failures"}`,
            icon: Server,
            testId: "stat-total-deployed",
          },
          {
            label: "SUCCESS RATE",
            value: depLoading ? null : (deployments.length > 0 ? Math.round(((deployments.length - failed) / deployments.length) * 100) + "%" : "N/A"),
            sub: `${stopped} stopped`,
            icon: TrendingUp,
            testId: "stat-success-rate",
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 border-card-border bg-card" data-testid={stat.testId}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium mb-2">{stat.label}</p>
                {stat.value === null ? (
                  <Skeleton className="h-7 w-16 mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 tracking-wide truncate">{stat.sub}</p>
              </div>
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: "Deploy Bot",
              desc: "Launch a new WhatsApp bot instance",
              icon: Rocket,
              href: "/deploy",
              testId: "quick-action-deploy",
            },
            {
              title: "View My Bots",
              desc: "Manage and monitor active deployments",
              icon: BotIcon,
              href: "/bots",
              testId: "quick-action-my-bots",
            },
            {
              title: "Browse Catalog",
              desc: "Explore available bot templates",
              icon: GitBranch,
              href: "/deploy",
              testId: "quick-action-catalog",
            },
          ].map((action) => (
            <Link key={action.title} href={action.href}>
              <div
                data-testid={action.testId}
                className="group flex items-center gap-4 p-4 rounded-md border border-border bg-card cursor-pointer hover-elevate transition-colors"
              >
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <action.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground tracking-wide">{action.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">{action.desc}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground flex-shrink-0 invisible group-hover:visible" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Deployments */}
      {deployments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Recent Deployments
            </h2>
            <Link href="/bots">
              <span className="text-[10px] text-primary tracking-wider uppercase cursor-pointer">View All</span>
            </Link>
          </div>
          <div className="space-y-2">
            {deployments.slice(0, 4).map((dep) => (
              <Link key={dep.id} href={`/bots/${dep.id}/logs`}>
                <div
                  data-testid={`deployment-row-${dep.id}`}
                  className="flex items-center gap-4 p-3 rounded-md border border-border bg-card hover-elevate cursor-pointer"
                >
                  <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BotIcon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground tracking-wide truncate">{dep.botName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{dep.url || "—"}</p>
                  </div>
                  <StatusBadge status={dep.status} />
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3 flex items-center gap-2">
          <Server className="w-3.5 h-3.5" />
          Bot Plans
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              data-testid={`plan-${plan.name.toLowerCase()}`}
              className={`relative p-4 rounded-md border bg-card ${
                plan.highlight
                  ? "border-primary/40 terminal-glow"
                  : "border-card-border"
              }`}
            >
              {plan.tag && (
                <div className="absolute -top-2.5 right-4">
                  <span className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded tracking-widest font-bold">
                    {plan.tag}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <plan.icon className={`w-4 h-4 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-bold tracking-wider uppercase text-foreground">{plan.name}</span>
              </div>
              <div className="mb-3">
                <span className={`text-xl font-bold ${plan.highlight ? "text-primary" : "text-foreground"}`}>
                  {plan.price}
                </span>
                <span className="text-[10px] text-muted-foreground">{plan.period}</span>
              </div>
              <div className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-primary/40 flex items-center justify-center flex-shrink-0">
                      <div className="w-1 h-1 rounded-full bg-primary" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant={plan.highlight ? "default" : "outline"}
                className="w-full text-[10px] tracking-widest uppercase"
                data-testid={`button-select-plan-${plan.name.toLowerCase()}`}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
