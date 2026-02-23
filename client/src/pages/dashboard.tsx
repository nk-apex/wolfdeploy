import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Server, Wallet, Users, Activity, Plus, ArrowUpRight,
  Zap, Check, Shield, Crown, Bot, Rocket, GitBranch, ExternalLink
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
  const { data: bots = [] } = useQuery<BotType[]>({
    queryKey: ["/api/bots"],
  });

  const bot = bots[0];
  const running = deployments.filter(d => d.status === "running").length;
  const failed = deployments.filter(d => d.status === "failed").length;
  const successRate = deployments.length > 0
    ? Math.round(((deployments.length - failed) / deployments.length) * 100)
    : 0;

  const statCards = [
    {
      icon: Bot,
      label: "Servers",
      value: depLoading ? "—" : running > 0 ? `${running}/${deployments.length}` : "0",
      subValue: running > 0 ? `${running} online` : "No servers deployed yet",
      link: "/bots",
      testId: "stat-servers",
    },
    {
      icon: Wallet,
      label: "Wallet Balance",
      value: "$0.00",
      subValue: "Available for deployment",
      link: "/",
      testId: "stat-wallet",
    },
    {
      icon: Server,
      label: "Total Deposits",
      value: "$0.00",
      subValue: "0 transactions",
      link: "/",
      testId: "stat-deposits",
    },
    {
      icon: Users,
      label: "Referrals",
      value: "0/10",
      subValue: "10 more to unlock Admin",
      link: "/",
      testId: "stat-referrals",
    },
  ];

  const quickActions = [
    { icon: Plus, label: "Deploy Server", path: "/deploy", desc: "Launch a new server instance" },
    { icon: Wallet, label: "Add Funds", path: "/", desc: "Deposit via M-Pesa or Card" },
    { icon: Users, label: "Invite Friends", path: "/", desc: "Earn 10% on referrals" },
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
            Welcome back, wolf
          </p>
        </div>
        <Link href="/deploy">
          <button
            className="group px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:opacity-90 transition-all"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
            data-testid="button-deploy-server"
          >
            <div className="flex items-center text-xs sm:text-sm font-mono text-primary">
              <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
              Deploy Server
            </div>
          </button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.link} data-testid={`link-stat-${stat.testId}`}>
            <div
              className="p-3 sm:p-5 rounded-xl group hover:border-primary/30 transition-colors h-full cursor-pointer"
              style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
            >
              <div className="flex justify-between items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-400 text-[9px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
                    {stat.label}
                  </p>
                  <h3 className="text-sm sm:text-2xl font-display font-bold text-white truncate" data-testid={`text-stat-value-${stat.testId}`}>
                    {stat.value}
                  </h3>
                </div>
                <div className="p-1 sm:p-2 rounded-lg shrink-0" style={{ background: "rgba(74,222,128,0.1)" }}>
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
              <div
                className="p-3 sm:p-6 rounded-xl hover:border-primary/40 transition-all group cursor-pointer"
                style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg group-hover:bg-primary/20 transition-colors" style={{ background: "rgba(74,222,128,0.1)" }}>
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
          <Server className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Server Plans
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {PLANS.map((plan) => (
            <Link key={plan.name} href="/deploy">
              <div
                data-testid={`plan-card-${plan.name.toLowerCase()}`}
                className="p-4 sm:p-5 rounded-xl hover:border-primary/40 transition-all group cursor-pointer relative overflow-hidden"
                style={{
                  border: `1px solid ${plan.highlight ? "rgba(74,222,128,0.4)" : "rgba(74,222,128,0.2)"}`,
                  background: "rgba(0,0,0,0.3)",
                  backdropFilter: "blur(8px)",
                  boxShadow: plan.highlight ? "0 0 20px rgba(74,222,128,0.06)" : "none",
                }}
              >
                {plan.highlight && (
                  <div
                    className="absolute top-0 right-0 text-primary text-[9px] sm:text-xs font-mono px-2 py-0.5 rounded-bl-lg"
                    style={{ background: "rgba(74,222,128,0.2)", borderLeft: "1px solid rgba(74,222,128,0.3)", borderBottom: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    POPULAR
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 sm:p-2 rounded-lg" style={{ background: "rgba(74,222,128,0.1)" }}>
                    <plan.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-white text-sm sm:text-base">{plan.name}</h3>
                </div>
                <div className="mb-3">
                  <span className="text-xl sm:text-2xl font-display font-bold text-primary">{plan.price}</span>
                  <span className="text-xs text-gray-500 font-mono ml-1">/server</span>
                </div>
                <div className="space-y-1.5">
                  {plan.specs.map((spec) => (
                    <div key={spec} className="flex items-center gap-2">
                      <Check className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(74,222,128,0.7)" }} />
                      <span className="text-xs font-mono text-gray-400">{spec}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(74,222,128,0.1)" }}>
                  <div className="flex items-center justify-center gap-1 text-xs font-mono text-primary/70 group-hover:text-primary transition-colors">
                    Top up {plan.price} to deploy
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Recent Deployments */}
        <div
          className="p-3 sm:p-6 rounded-xl"
          style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        >
          <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center text-white">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Recent Deployments
          </h2>
          <div className="space-y-3">
            {deployments.length > 0 ? (
              deployments.slice(0, 5).map((dep) => (
                <Link key={dep.id} href={`/bots/${dep.id}/logs`}>
                  <div
                    className="p-3 rounded-lg hover:border-primary/30 transition-colors bg-black/20 cursor-pointer"
                    style={{ border: "1px solid rgba(74,222,128,0.1)" }}
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
              <div
                className="min-h-[180px] flex flex-col items-center justify-center text-gray-500 font-mono text-sm rounded-lg gap-3"
                style={{ border: "1px dashed rgba(74,222,128,0.1)" }}
              >
                <Bot className="w-8 h-8" style={{ color: "rgba(74,222,128,0.3)" }} />
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

        {/* Silent WolfBot Featured */}
        <div
          className="p-3 sm:p-6 rounded-xl"
          style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex flex-wrap justify-between items-center mb-4 sm:mb-6 gap-2">
            <h2 className="text-base sm:text-xl font-bold flex items-center text-white">
              <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" /> Available Bot
            </h2>
            <Link href="/deploy" className="text-xs text-primary hover:underline font-mono flex items-center gap-1" data-testid="link-deploy-bot">
              Deploy <ArrowUpRight size={12} />
            </Link>
          </div>

          {bot && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-sm sm:text-base">{bot.name}</p>
                  <span className="text-[9px] text-primary font-mono" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "1px 6px", borderRadius: "4px" }}>
                    {bot.category}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 font-mono leading-relaxed">{bot.description}</p>

              <div className="space-y-2">
                {Object.entries(bot.env).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(74,222,128,0.1)" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-[10px] text-gray-400 font-mono">{key}</span>
                    {cfg.required && (
                      <span className="text-[8px] text-primary font-mono ml-auto" style={{ border: "1px solid rgba(74,222,128,0.3)", padding: "1px 4px", borderRadius: "3px" }}>
                        REQUIRED
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <a
                href={bot.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-primary font-mono hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {bot.repository}
              </a>

              <Link href="/deploy">
                <button
                  className="w-full py-2 rounded-lg font-mono text-sm font-bold text-primary transition-all hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
                  data-testid="button-deploy-wolf"
                >
                  <Rocket className="w-4 h-4" />
                  Deploy Now
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
