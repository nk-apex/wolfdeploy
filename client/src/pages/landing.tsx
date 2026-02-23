import { Link } from "wouter";
import {
  Rocket, Shield, Zap, Bot, Check, ArrowRight, Terminal,
  Star, Globe, Github, ExternalLink
} from "lucide-react";

const FEATURES = [
  {
    icon: Rocket,
    title: "One-Click Deployment",
    desc: "Paste your session ID and phone number — we handle cloning, installing and running your bot automatically.",
  },
  {
    icon: Shield,
    title: "Secure & Isolated",
    desc: "Each deployment runs in its own isolated process with your secrets never exposed in logs.",
  },
  {
    icon: Zap,
    title: "Real-Time Logs",
    desc: "Watch your bot start live with streaming terminal logs directly in the dashboard.",
  },
  {
    icon: Bot,
    title: "WhatsApp Ready",
    desc: "Pre-configured templates for popular Baileys-based bots. Session auth handled automatically.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$5",
    period: "/server",
    features: ["1 Bot Instance", "512MB RAM", "Shared CPU", "Community Support"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$15",
    period: "/server",
    features: ["Unlimited Bots", "2GB RAM", "Dedicated CPU", "Priority Support"],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "/server",
    features: ["Unlimited Bots", "8GB RAM", "Dedicated Server", "24/7 Support"],
    cta: "Contact Us",
    highlight: false,
  },
];

const BOTS = [
  { name: "Silent WolfBot", repo: "7silent-wolf/silentwolf", badge: "Popular" },
  { name: "JUNE-X", repo: "Vinpink2/JUNE-X", badge: "New" },
];

export default function Landing() {
  return (
    <div
      className="min-h-screen font-mono"
      style={{ background: "#080808", color: "#fff" }}
    >
      {/* Grid bg */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(74,222,128,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Navbar */}
      <nav
        className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-4"
        style={{ borderBottom: "1px solid rgba(74,222,128,0.1)", backdropFilter: "blur(12px)", background: "rgba(8,8,8,0.8)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "hsl(142 76% 42%)" }}
          >
            W
          </div>
          <span className="font-black tracking-widest text-primary text-sm uppercase">WolfDeploy</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <button
              data-testid="button-nav-login"
              className="px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors font-mono"
            >
              Log In
            </button>
          </Link>
          <Link href="/signup">
            <button
              data-testid="button-nav-signup"
              className="px-4 py-1.5 text-xs font-mono rounded-lg font-bold transition-all"
              style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
            >
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      <div className="relative z-10">
        {/* Hero */}
        <section className="text-center px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] mb-6"
            style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary tracking-widest font-bold">POWERED BY BAILEYS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4 leading-tight">
            Deploy WhatsApp Bots{" "}
            <span style={{ color: "hsl(142 76% 42%)" }}>in Seconds</span>
          </h1>

          <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
            WolfDeploy is a Heroku-style platform for WhatsApp bots. Drop in your session ID, hit deploy — your bot goes live instantly with real-time logs and auto-restart.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <button
                data-testid="button-hero-deploy"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
              >
                <Rocket className="w-4 h-4" />
                Deploy Now — It's Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a
              href="https://github.com/7silent-wolf/silentwolf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-gray-400 transition-all hover:text-white"
              style={{ border: "1px solid rgba(74,222,128,0.15)" }}
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>

          {/* Terminal mock */}
          <div
            className="mt-14 mx-auto max-w-2xl rounded-2xl overflow-hidden text-left"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid rgba(74,222,128,0.1)", background: "rgba(0,0,0,0.3)" }}
            >
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-white font-bold tracking-widest">DEPLOYMENT LOGS</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] text-primary tracking-widest">LIVE</span>
              </div>
            </div>
            <div className="p-4 space-y-1.5 text-[11px]">
              {[
                { t: "16:50:04", l: "[INFO ]", m: "Cloning repository from GitHub...", c: "text-gray-400" },
                { t: "16:50:05", l: "[INFO ]", m: "Repository cloned successfully.", c: "text-gray-400" },
                { t: "16:50:06", l: "[INFO ]", m: "Installing Node.js dependencies (npm install)...", c: "text-gray-400" },
                { t: "16:50:08", l: "[INFO ]", m: "Dependencies installed.", c: "text-gray-400" },
                { t: "16:50:09", l: "[INFO ]", m: "Setting environment variables...", c: "text-gray-400" },
                { t: "16:50:14", l: "[INFO ]", m: "Health checks passed.", c: "text-gray-400" },
                { t: "16:50:15", l: "[ OK ]", m: "Bot is online and ready to receive WhatsApp messages", c: "text-green-400" },
              ].map((line) => (
                <div key={line.t} className="flex gap-3">
                  <span className="text-gray-700 flex-shrink-0">{line.t}</span>
                  <span className={`${line.c} font-bold flex-shrink-0`}>{line.l}</span>
                  <span className={line.c}>{line.m}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-primary">$</span>
                <span className="w-2 h-3.5 bg-primary animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-primary font-bold tracking-widest uppercase mb-2">WHY WOLFDEPLOY</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Everything your bot needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-5 rounded-xl"
                style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(74,222,128,0.1)" }}>
                  <f.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Available bots */}
        <section className="px-6 sm:px-10 py-12 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] text-primary font-bold tracking-widest uppercase mb-2">BOT CATALOG</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Ready-to-deploy bots</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {BOTS.map((b) => (
              <Link key={b.name} href="/signup">
                <div
                  className="p-5 rounded-xl group hover:border-primary/40 transition-all cursor-pointer"
                  style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{ background: "rgba(74,222,128,0.1)" }}>
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <span
                      className="text-[9px] font-bold text-primary px-2 py-0.5 rounded"
                      style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}
                    >
                      {b.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1">{b.name}</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <Github className="w-3 h-3" />
                    <span>{b.repo}</span>
                  </div>
                  <div
                    className="mt-3 pt-3 flex items-center justify-between"
                    style={{ borderTop: "1px solid rgba(74,222,128,0.1)" }}
                  >
                    <span className="text-[10px] text-primary font-bold">Deploy this bot</span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-primary font-bold tracking-widest uppercase mb-2">PRICING</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Simple, transparent pricing</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="p-6 rounded-xl relative overflow-hidden"
                style={{
                  border: `1px solid ${plan.highlight ? "rgba(74,222,128,0.4)" : "rgba(74,222,128,0.15)"}`,
                  background: "rgba(0,0,0,0.3)",
                  backdropFilter: "blur(8px)",
                  boxShadow: plan.highlight ? "0 0 30px rgba(74,222,128,0.06)" : "none",
                }}
              >
                {plan.highlight && (
                  <div
                    className="absolute top-0 right-0 text-[9px] text-primary px-2 py-0.5 font-bold rounded-bl-lg"
                    style={{ background: "rgba(74,222,128,0.15)", borderLeft: "1px solid rgba(74,222,128,0.3)", borderBottom: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-black text-white mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-black text-primary">{plan.price}</span>
                  <span className="text-xs text-gray-500 ml-1">{plan.period}</span>
                </div>
                <div className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-[11px] text-gray-400">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/signup">
                  <button
                    className="w-full py-2.5 rounded-lg font-bold text-xs transition-all hover:opacity-90"
                    style={{
                      background: plan.highlight ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.08)",
                      border: `1px solid ${plan.highlight ? "rgba(74,222,128,0.4)" : "rgba(74,222,128,0.2)"}`,
                      color: "hsl(142 76% 42%)",
                    }}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-16 text-center max-w-2xl mx-auto">
          <div
            className="p-10 rounded-2xl"
            style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
          >
            <Globe className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">Ready to go live?</h2>
            <p className="text-sm text-gray-400 mb-6">Create a free account and deploy your first bot in under 2 minutes.</p>
            <Link href="/signup">
              <button
                data-testid="button-cta-signup"
                className="flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
              >
                <Rocket className="w-4 h-4" />
                Create Free Account
              </button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="px-6 sm:px-10 py-6 text-center"
          style={{ borderTop: "1px solid rgba(74,222,128,0.08)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
            <span className="text-[10px] text-gray-700 font-mono">© 2026 WolfDeploy. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Login</Link>
              <Link href="/signup" className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Sign Up</Link>
              <a href="https://github.com/7silent-wolf/silentwolf" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1">
                <Github className="w-3 h-3" />GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
