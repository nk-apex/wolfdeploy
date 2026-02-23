import { useState } from "react";
import { Users, Copy, Check, Share2, Gift, Trophy, ChevronRight, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";

function generateReferralCode(userId: string) {
  const short = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `WOLF-${short}`;
}

const TIERS = [
  { threshold: 0, label: "Rookie", color: "#9ca3af", reward: "5% commission" },
  { threshold: 5, label: "Hunter", color: "#3b82f6", reward: "8% commission" },
  { threshold: 10, label: "Alpha Wolf", color: "#8b5cf6", reward: "10% + Admin badge" },
  { threshold: 25, label: "Pack Leader", color: "#f59e0b", reward: "15% + Priority support" },
  { threshold: 50, label: "Wolf King", color: "#ef4444", reward: "20% + Custom domain" },
];

export default function Referrals() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();

  const referralCode = generateReferralCode(user?.id || "wolfdeploy");
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const [copied, setCopied] = useState(false);
  const referralCount = 0;
  const earnings = 0;

  const currentTier = TIERS.reduce((best, tier) => referralCount >= tier.threshold ? tier : best, TIERS[0]);
  const nextTier = TIERS.find(tier => tier.threshold > referralCount);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: "Join WolfDeploy", text: "Deploy WhatsApp bots instantly with WolfDeploy!", url: referralLink });
    } else {
      copyLink();
    }
  }

  const cardBg = t.glassEffect ? t.cardBg : "rgba(0,0,0,0.35)";
  const cardBorder = t.glassEffect ? t.cardBorder : t.accentFaded(0.15);
  const panelStyle = { background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: t.backdropBlur };

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 min-h-full" data-testid="referrals-page">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Referral Program</h1>
        <p className="text-xs sm:text-sm font-mono" style={{ color: t.textMuted }}>
          Invite friends to WolfDeploy and earn commissions on every payment they make.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Referrals", value: referralCount.toString(), icon: Users },
          { label: "Total Earned", value: `$${earnings.toFixed(2)}`, icon: Gift },
          { label: "Current Tier", value: currentTier.label, icon: Trophy, color: currentTier.color },
          { label: "Next Milestone", value: nextTier ? `${nextTier.threshold - referralCount} more` : "Max tier!", icon: ChevronRight },
        ].map(card => {
          const CardIcon = card.icon;
          return (
            <div key={card.label} className="p-4 sm:p-5 rounded-xl" style={panelStyle} data-testid={`stat-referral-${card.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider" style={{ color: t.textMuted }}>{card.label}</p>
                <CardIcon className="w-3.5 h-3.5" style={{ color: card.color || t.accent }} />
              </div>
              <p className="text-base sm:text-xl font-bold font-display text-white" style={card.color ? { color: card.color } : {}}>
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Referral link */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={panelStyle}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Share2 className="w-4 h-4" style={{ color: t.accent }} /> Your Referral Link
        </h2>

        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Referral Code</p>
          <div
            className="inline-flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest"
            style={{ background: t.accentFaded(0.08), border: `1px solid ${t.accentFaded(0.25)}`, color: t.accent }}
          >
            {referralCode}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Shareable Link</p>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.12)}` }}
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.textMuted }} />
            <span className="font-mono text-xs text-white flex-1 truncate">{referralLink}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            data-testid="button-copy-referral"
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: t.accentFaded(0.1), color: t.accent, border: `1px solid ${t.accentFaded(0.3)}` }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            data-testid="button-share-referral"
            onClick={shareLink}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: t.accent, color: "#000" }}
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>

      {/* Tiers */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={panelStyle}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: t.accent }} /> Reward Tiers
        </h2>

        <div className="space-y-3">
          {TIERS.map((tier, i) => {
            const isActive = currentTier.label === tier.label;
            const isPast = referralCount >= tier.threshold;
            return (
              <div
                key={tier.label}
                data-testid={`tier-${tier.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center gap-4 p-4 rounded-xl transition-all"
                style={{
                  background: isActive ? `${tier.color}12` : t.accentFaded(0.03),
                  border: `1px solid ${isActive ? tier.color + "40" : t.accentFaded(0.08)}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs"
                  style={{ background: isPast ? `${tier.color}20` : "rgba(255,255,255,0.04)", color: tier.color, border: `1px solid ${tier.color}40` }}
                >
                  {tier.threshold}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-white">{tier.label}</p>
                    {isActive && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${tier.color}20`, color: tier.color }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>
                    {tier.threshold === 0 ? "Start" : `${tier.threshold} referrals`} · {tier.reward}
                  </p>
                </div>
                {isPast && <Check className="w-4 h-4 flex-shrink-0" style={{ color: tier.color }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={panelStyle}>
        <h2 className="text-sm font-bold text-white">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "01", title: "Share Your Link", desc: "Send your referral link to friends who want to deploy WhatsApp bots." },
            { step: "02", title: "They Sign Up", desc: "When they register using your link, they're permanently linked to your account." },
            { step: "03", title: "Earn Commission", desc: "You earn a percentage every time they pay for a plan — automatically." },
          ].map(s => (
            <div key={s.step} className="p-4 rounded-xl" style={{ background: t.accentFaded(0.04), border: `1px solid ${t.accentFaded(0.08)}` }}>
              <div className="text-2xl font-black font-display mb-2" style={{ color: t.accentFaded(0.4) }}>{s.step}</div>
              <p className="text-xs font-bold text-white mb-1">{s.title}</p>
              <p className="text-[10px] font-mono leading-relaxed" style={{ color: t.textMuted }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
