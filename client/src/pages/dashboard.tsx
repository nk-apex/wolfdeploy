import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Server, Wallet, Users, Activity, Plus, ArrowUpRight,
  Zap, Check, Shield, Crown, Bot, Rocket, GitBranch
} from "lucide-react";
import type { Deployment, Bot as BotType } from "@shared/schema";
import { StatusBadge } from "@/components/status-badge";

const PLANS = [
  {
    name: "Starter",
    price: "$5.00",
    icon: Zap,
    specs: ["1 Bot Instance", "512MB RAM", "Shared CPU", "Community Support"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$15.00",
    icon: Shield,
    specs: ["Unlimited Bots", "2GB RAM", "Dedicated CPU", "Priority Support"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "$49.00",
    icon: Crown,
    specs: ["Unlimited Bots", "8GB RAM", "Dedicated Server", "24/7 Support"],
    highlight: false,
  },
];

export default function Dashboard() {
  const { data: deployments = [], isLoading: depLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    refetchInterval: 4000,
  });
  const { data: bots = [], isLoading: botsLoading } = useQuery<BotType[]>({
    queryKey: ["/api/bots"],
  });

  const running = deployments.filter(d => d.status === "running").length;
  const failed = deployments.filter(d => d.status === "failed").length;
  const successRate = deployments.length > 0
    ? Math.round(((deployments.length - failed) / deployments.length) * 100)
    : 0;

  const statCards = [
    {
      icon: Bot,
      label: "Active Bots",
      value: depLoading ? "—" : running > 0 ? `${running}/${deployments.length}` : "0",
      subValue: running > 0 ? `${running} running` : "No bots deployed yet",
      link: "/bots",
      testId: "stat-active-bots",
    },
    {
      icon: GitBranch,
      label: "Bot Catalog",
      value: botsLoading ? "—" : String(bots.length),
      subValue: "Available to deploy",
      link: "/deploy",
      testId: "stat-catalog",
    },
    {
      icon: Server,
      label: "Total Deployed",
      value: depLoading ? "—" : String(deployments.length),
      subValue: `${failed > 0 ? failed + " failed" : "0 failures"}`,
      link: "/bots",
      testId: "stat-total",
    },
    {
      icon: Users,
      label: "Success Rate",
      value: depLoading ? "—" : deployments.length > 0 ? `${successRate}%` : "N/A",
      subValue: deployments.length > 0 ? `${deployments.length} total deployments` : "Deploy your first bot",
      link: "/bots",
      testId: "stat-success",
    },
  ];

  const quickActions = [
    { icon: Plus, label: "Deploy Bot", path: "/deploy", desc: "Launch a new bot instance" },
    { icon: Wallet, label: "Bot Catalog", path: "/deploy", desc: "Browse available bots" },
    { icon: Users, label: "View All Bots", path: "/bots", desc: "Manage your deployments" },
  ];

  return (
    <div className="space-y-4 sm:space-y-8 p-4 sm:p-6" data-testid="overview-page">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-wrap justify-between items-end gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 text-white" data-testid="text-welcome-heading">
            Command Center
          </h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm" data-testid="text-welcome-message">
            Welcome back, user
          </p>
        </div>
        <Link href="/deploy">
          <button
            className="group px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all"
            data-testid="button-deploy-server"
          >
            <div className="flex items-center text-xs sm:text-sm font-mono text-primary">
              <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
              Deploy Bot
            </div>
          </button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.link} data-testid={`link-stat-${stat.testId}`}>
            <div className="p-3 sm:p-5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm group hover:border-primary/30 transition-colors h-full cursor-pointer">
              <div className="flex justify-between items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-400 text-[9px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
                    {stat.label}
                  </p>
                  <h3
                    className="text-sm sm:text-2xl font-display font-bold text-white truncate"
                    data-testid={`text-stat-value-${stat.testId}`}
                  >
                    {stat.value}
                  </h3>
                </div>
                <div className="p-1 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                  <stat.icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-primary" />
                </div>
              </div>
              <div className="mt-1.5 sm:mt-3 text-[9px] sm:text-xs text-gray-500 font-mono truncate">
                {stat.subValue}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center text-white">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.path} data-testid={`link-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="p-3 sm:p-6 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm hover:border-primary/40 transition-all group cursor-pointer">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm sm:text-base">{action.label}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-mono mt-0.5 sm:mt-1">{action.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bot Plans */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center text-white">
          <Server className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Bot Plans
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {PLANS.map((plan) => (
            <Link key={plan.name} href="/deploy">
              <div
                data-testid={`plan-card-${plan.name.toLowerCase()}`}
                className={`p-4 sm:p-5 rounded-xl border bg-black/30 backdrop-blur-sm hover:border-primary/40 transition-all group cursor-pointer relative overflow-hidden ${
                  plan.highlight
                    ? "border-primary/40 shadow-[0_0_20px_rgba(74,222,128,0.08)]"
                    : "border-primary/20"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[9px] sm:text-xs font-mono px-2 py-0.5 rounded-bl-lg border-l border-b border-primary/30">
                    POPULAR
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                    <plan.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-white text-sm sm:text-base">{plan.name}</h3>
                </div>
                <div className="mb-3">
                  <span className="text-xl sm:text-2xl font-display font-bold text-primary">{plan.price}</span>
                  <span className="text-xs text-gray-500 font-mono ml-1">/bot/mo</span>
                </div>
                <div className="space-y-1.5">
                  {plan.specs.map((spec) => (
                    <div key={spec} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-primary/70 flex-shrink-0" />
                      <span className="text-xs font-mono text-gray-400">{spec}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <div className="flex items-center justify-center gap-1 text-xs font-mono text-primary/70 group-hover:text-primary transition-colors">
                    Deploy Now <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        <div className="p-3 sm:p-6 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm">
          <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center text-white">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Recent Deployments
          </h2>
          <div className="space-y-3">
            {deployments.length > 0 ? (
              deployments.slice(0, 5).map((dep) => (
                <Link key={dep.id} href={`/bots/${dep.id}/logs`}>
                  <div
                    className="p-3 rounded-lg border border-primary/10 hover:border-primary/30 transition-colors bg-black/20 cursor-pointer"
                    data-testid={`card-deployment-${dep.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate text-white">{dep.botName}</p>
                        <p className="text-xs text-gray-600 mt-0.5 font-mono truncate">{dep.url}</p>
                      </div>
                      <StatusBadge status={dep.status} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="min-h-[180px] flex flex-col items-center justify-center text-gray-500 font-mono text-sm border border-dashed border-primary/10 rounded-lg gap-3">
                <Bot className="w-8 h-8 text-primary/30" />
                <p className="text-xs">No deployments yet</p>
                <Link href="/deploy" className="text-primary text-xs hover:underline" data-testid="link-deploy-first">
                  Deploy your first bot
                </Link>
              </div>
            )}
            {deployments.length > 0 && (
              <Link href="/bots" className="block text-center text-xs text-primary hover:underline font-mono mt-2" data-testid="link-view-all-deployments">
                View all deployments
              </Link>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-6 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center mb-4 sm:mb-6 gap-2">
            <h2 className="text-base sm:text-xl font-bold flex items-center text-white">
              <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Top Bots
            </h2>
            <Link href="/deploy" className="text-xs text-primary hover:underline font-mono flex items-center gap-1" data-testid="link-view-catalog">
              View All <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {bots.slice(0, 4).map((bot) => (
              <Link key={bot.id} href={`/deploy/${bot.id}`}>
                <div className="p-3 rounded-lg border border-primary/10 hover:border-primary/30 transition-colors bg-black/20 cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                      <Rocket className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white truncate">{bot.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{bot.category}</p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-xs text-gray-600 font-mono text-center">
              {bots.length} bots available in the catalog
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
