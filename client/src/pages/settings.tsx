import { useState } from "react";
import { User, Palette, Bell, Shield, Save, Check, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens, THEMES } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [activeSection, setActiveSection] = useState("appearance");
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""
  );
  const [notifications, setNotifications] = useState({
    deploySuccess: true,
    botCrash: true,
    billing: true,
    referrals: false,
  });

  const cardBg = t.glassEffect ? t.cardBg : "rgba(0,0,0,0.35)";
  const cardBorder = t.glassEffect ? t.cardBorder : t.accentFaded(0.15);
  const panelStyle = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    backdropFilter: t.backdropBlur,
  };

  return (
    <div className="p-4 sm:p-6 min-h-full" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Settings</h1>
        <p className="text-xs sm:text-sm font-mono" style={{ color: t.textMuted }}>
          Manage your account, appearance, and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar nav */}
        <div className="lg:w-48 flex-shrink-0">
          <div className="rounded-xl overflow-hidden" style={panelStyle}>
            {SECTIONS.map(s => {
              const SIcon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  data-testid={`settings-nav-${s.id}`}
                  onClick={() => setActiveSection(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all relative"
                  style={{
                    background: active ? t.accentFaded(0.08) : "transparent",
                    borderLeft: active ? `2px solid ${t.accent}` : "2px solid transparent",
                    color: active ? t.accent : t.textMuted,
                  }}
                >
                  <SIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-mono">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Profile */}
          {activeSection === "profile" && (
            <div className="rounded-2xl p-5 sm:p-6 space-y-5" style={panelStyle}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4" style={{ color: t.accent }} /> Profile
              </h2>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>
                  Display Name
                </label>
                <input
                  data-testid="input-display-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl font-mono text-sm text-white outline-none transition-all"
                  style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.2)}` }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>
                  Email Address
                </label>
                <input
                  data-testid="input-email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-3 rounded-xl font-mono text-sm outline-none"
                  style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}`, color: t.textMuted }}
                />
                <p className="text-[10px] font-mono mt-1.5" style={{ color: t.textMuted }}>Email cannot be changed.</p>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>
                  Account ID
                </label>
                <div
                  className="w-full px-4 py-3 rounded-xl font-mono text-xs truncate"
                  style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}`, color: t.textMuted }}
                >
                  {user?.id || "—"}
                </div>
              </div>

              <button
                data-testid="button-save-profile"
                onClick={() => toast({ title: "Profile saved!" })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all"
                style={{ background: t.accentFaded(0.1), color: t.accent, border: `1px solid ${t.accentFaded(0.3)}` }}
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <div className="rounded-2xl p-5 sm:p-6 space-y-6" style={panelStyle}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: t.accent }} /> Appearance
              </h2>
              <p className="text-xs font-mono" style={{ color: t.textMuted }}>
                Choose the site theme. Changes apply instantly across all pages.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {THEMES.map((th) => {
                  const active = theme === th.id;
                  return (
                    <button
                      key={th.id}
                      data-testid={`button-theme-${th.id}`}
                      onClick={() => setTheme(th.id)}
                      className="text-left p-4 rounded-2xl transition-all relative overflow-hidden group"
                      style={{
                        border: `1.5px solid ${active ? t.accent : t.accentFaded(0.12)}`,
                        background: active ? t.accentFaded(0.07) : cardBg,
                        backdropFilter: t.backdropBlur,
                      }}
                    >
                      {/* Preview swatch */}
                      <div
                        className="w-full h-16 rounded-xl mb-3 relative overflow-hidden"
                        style={{ background: th.preview }}
                      >
                        {th.id === "glass" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div
                              className="w-24 h-8 rounded-full"
                              style={{ background: "rgba(34,211,238,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,211,238,0.2)" }}
                            />
                          </div>
                        )}
                        <div
                          className="absolute bottom-2 right-2 w-6 h-6 rounded-full"
                          style={{ background: th.id === "glass" ? "rgba(34,211,238,0.7)" : th.id === "neon" ? "rgba(168,85,247,0.7)" : th.id === "matrix" ? "rgba(0,200,80,0.7)" : "rgba(74,222,128,0.7)" }}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-white font-display mb-0.5">{th.label}</p>
                          <p className="text-[10px] font-mono leading-relaxed" style={{ color: t.textMuted }}>{th.desc}</p>
                        </div>
                        {active && (
                          <div
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: t.accentFaded(0.2), border: `1px solid ${t.accent}` }}
                          >
                            <Check className="w-3 h-3" style={{ color: t.accent }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active theme badge */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.textMuted }}>Active theme:</span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full" style={{ background: t.accentFaded(0.1), color: t.accent }}>
                  {THEMES.find(th => th.id === theme)?.label}
                </span>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <div className="rounded-2xl p-5 sm:p-6 space-y-5" style={panelStyle}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: t.accent }} /> Notifications
              </h2>

              {Object.entries({
                deploySuccess: "Deployment Success",
                botCrash: "Bot Crash Alerts",
                billing: "Billing Updates",
                referrals: "Referral Activity",
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b" style={{ borderColor: t.accentFaded(0.08) }}>
                  <div>
                    <p className="text-sm font-mono text-white">{label}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: t.textMuted }}>
                      Receive alerts for {label.toLowerCase()}
                    </p>
                  </div>
                  <button
                    data-testid={`toggle-notif-${key}`}
                    onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                    className="relative w-10 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ background: notifications[key as keyof typeof notifications] ? t.accentFaded(0.3) : t.accentFaded(0.06), border: `1px solid ${notifications[key as keyof typeof notifications] ? t.accentFaded(0.5) : t.accentFaded(0.15)}` }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{
                        background: notifications[key as keyof typeof notifications] ? t.accent : t.accentFaded(0.3),
                        left: notifications[key as keyof typeof notifications] ? "calc(100% - 22px)" : "2px",
                      }}
                    />
                  </button>
                </div>
              ))}

              <button
                data-testid="button-save-notifications"
                onClick={() => toast({ title: "Notification preferences saved!" })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider"
                style={{ background: t.accentFaded(0.1), color: t.accent, border: `1px solid ${t.accentFaded(0.3)}` }}
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          )}

          {/* Security */}
          {activeSection === "security" && (
            <div className="rounded-2xl p-5 sm:p-6 space-y-5" style={panelStyle}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: t.accent }} /> Security
              </h2>

              <div className="p-4 rounded-xl" style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.12)}` }}>
                <p className="text-xs font-mono text-white mb-0.5">Authentication Method</p>
                <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>Email & Password via Supabase Auth</p>
              </div>

              <div className="p-4 rounded-xl" style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.12)}` }}>
                <p className="text-xs font-mono text-white mb-0.5">Last Sign In</p>
                <p className="text-[10px] font-mono" style={{ color: t.textMuted }}>
                  {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}
                </p>
              </div>

              <button
                data-testid="button-sign-out-settings"
                onClick={async () => { await signOut(); navigate("/login"); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all"
                style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
