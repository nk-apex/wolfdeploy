import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, Bot, CreditCard, Rocket, Bell,
  Shield, Trash2, Plus, Power, PowerOff, Star, ChevronDown,
  ChevronUp, CheckCircle, XCircle, Clock, AlertTriangle,
  Coins, TrendingUp, Activity, RefreshCw, Edit, X, Check,
  UserCheck, UserX, Eye, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdminStats = {
  totalUsers: number;
  totalCoinsInCirculation: number;
  totalBots: number;
  activeBots: number;
  totalDeployments: number;
  runningDeployments: number;
  failedDeployments: number;
  totalTransactions: number;
  successTransactions: number;
  totalRevenue: number;
  totalNotifications: number;
};

type AdminUser = {
  userId: string;
  balance: number;
  isAdmin: boolean;
  deploymentCount: number;
  runningBots: number;
};

type PlatformBot = {
  id: string;
  name: string;
  description: string;
  repository: string;
  logo: string | null;
  keywords: string[];
  category: string | null;
  stars: number | null;
  env: Record<string, { description: string; required: boolean; placeholder?: string }>;
  active: boolean | null;
  createdAt: string | null;
};

type PaymentTx = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  coins: number;
  status: string;
  reference: string;
  provider: string | null;
  createdAt: string | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  active: boolean | null;
  createdAt: string | null;
};

type Deployment = {
  id: string;
  botId: string;
  botName: string;
  userId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "bots", label: "Bot Catalog", icon: Bot },
  { id: "deployments", label: "Deployments", icon: Rocket },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: any }> = {
    running: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: Activity },
    stopped: { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: PowerOff },
    failed: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
    deploying: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: RefreshCw },
    queued: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
    success: { color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle },
    pending: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
  };
  const cfg = map[status] ?? { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-mono ${cfg.color}`}>
      <Icon size={10} />
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className={`rounded-xl p-4 border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono mb-0.5">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, signIn, signOut } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Check admin status
  const { data: adminCheck, isLoading: checkLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    refetchOnWindowFocus: false,
  });

  const userId = user?.id ?? "";

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!adminCheck?.isAdmin,
    refetchInterval: 10000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: activeTab === "users" && !!adminCheck?.isAdmin,
    refetchInterval: 15000,
  });

  const { data: bots = [], isLoading: botsLoading } = useQuery<PlatformBot[]>({
    queryKey: ["/api/admin/bots"],
    enabled: activeTab === "bots" && !!adminCheck?.isAdmin,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<PaymentTx[]>({
    queryKey: ["/api/admin/payments"],
    enabled: activeTab === "payments" && !!adminCheck?.isAdmin,
    refetchInterval: 20000,
  });

  const { data: deployments = [], isLoading: deploymentsLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/admin/deployments"],
    enabled: activeTab === "deployments" && !!adminCheck?.isAdmin,
    refetchInterval: 8000,
  });

  const { data: notifs = [], isLoading: notifsLoading } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    enabled: activeTab === "notifications" && !!adminCheck?.isAdmin,
  });

  // Mutations
  const deleteUserMutation = useMutation({
    mutationFn: (uid: string) => apiRequest("DELETE", `/api/admin/users/${uid}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "User deleted" }); },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
  });

  const adjustCoinsMutation = useMutation({
    mutationFn: ({ uid, amount }: { uid: string; amount: number }) =>
      apiRequest("POST", `/api/admin/users/${uid}/adjust-coins`, { amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Coins adjusted" }); },
    onError: () => toast({ title: "Failed to adjust coins", variant: "destructive" }),
  });

  const grantAdminMutation = useMutation({
    mutationFn: (uid: string) => apiRequest("POST", `/api/admin/users/${uid}/grant-admin`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Admin granted" }); },
  });

  const revokeAdminMutation = useMutation({
    mutationFn: (uid: string) => apiRequest("DELETE", `/api/admin/users/${uid}/revoke-admin`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Admin revoked" }); },
    onError: (e: any) => toast({ title: e.message || "Cannot revoke admin", variant: "destructive" }),
  });

  const toggleBotMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PUT", `/api/admin/bots/${id}`, { active }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] }); queryClient.invalidateQueries({ queryKey: ["/api/bots"] }); toast({ title: "Bot updated" }); },
    onError: () => toast({ title: "Failed to update bot", variant: "destructive" }),
  });

  const deleteBotMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/bots/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] }); queryClient.invalidateQueries({ queryKey: ["/api/bots"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Bot deleted" }); },
    onError: () => toast({ title: "Failed to delete bot", variant: "destructive" }),
  });

  const stopDepMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/deployments/${id}/stop`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Deployment stopped" }); },
    onError: () => toast({ title: "Failed to stop deployment", variant: "destructive" }),
  });

  const deleteDepMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/deployments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Deployment deleted" }); },
    onError: () => toast({ title: "Failed to delete deployment", variant: "destructive" }),
  });

  const deleteNotifMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/notifications/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Notification deleted" }); },
  });

  const toggleNotifMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PUT", `/api/admin/notifications/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] }),
  });

  // New bot form
  const [botForm, setBotForm] = useState({ name: "", description: "", repository: "", logo: "", category: "WhatsApp Bot", keywords: "" });
  const [showBotForm, setShowBotForm] = useState(false);

  const addBotMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/bots", {
      ...botForm,
      keywords: botForm.keywords.split(",").map(k => k.trim()).filter(Boolean),
      env: {
        SESSION_ID: { description: "Your session ID for this bot", required: true, placeholder: "SESSION_xxxxxxxxxxxx" },
        PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+254712345678" },
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setBotForm({ name: "", description: "", repository: "", logo: "", category: "WhatsApp Bot", keywords: "" });
      setShowBotForm(false);
      toast({ title: "Bot added to catalog" });
    },
    onError: () => toast({ title: "Failed to add bot", variant: "destructive" }),
  });

  // New notification form
  const [notifForm, setNotifForm] = useState({ title: "", message: "", type: "info" });
  const [showNotifForm, setShowNotifForm] = useState(false);

  const addNotifMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/notifications", notifForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNotifForm({ title: "", message: "", type: "info" });
      setShowNotifForm(false);
      toast({ title: "Notification published" });
    },
    onError: () => toast({ title: "Failed to publish notification", variant: "destructive" }),
  });

  // Coin adjust inline state
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      setLoginError(error);
      setLoginLoading(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
    setLoginLoading(false);
  }

  if (checkLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <RefreshCw size={20} className="animate-spin mr-2" /> Checking access…
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${t.accentFaded(0.12)}`,
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: t.accentFaded(0.1), border: `1px solid ${t.accentFaded(0.3)}` }}
            >
              <Shield size={26} style={{ color: t.accent }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: t.accent }}>Wolf Panel</h2>
            <p className="text-gray-500 text-xs mt-1">Administrator access only</p>
          </div>

          {user && !adminCheck?.isAdmin ? (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                The account <span className="text-white font-medium">{user.email}</span> does not have admin privileges.
              </p>
              <Button
                data-testid="button-signout-wolf"
                variant="outline"
                className="w-full text-sm"
                style={{ borderColor: t.accentFaded(0.2), color: t.accent }}
                onClick={async () => { await signOut(); queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] }); }}
              >
                Sign in with a different account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
              <Input
                data-testid="input-wolf-email"
                type="email"
                placeholder="Admin email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
              />
              <div className="relative">
                <Input
                  data-testid="input-wolf-password"
                  type={showLoginPw ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {loginError && (
                <p className="text-xs text-red-400 text-center">{loginError}</p>
              )}
              <Button
                data-testid="button-wolf-login"
                type="submit"
                disabled={loginLoading}
                className="w-full font-bold mt-1"
                style={{ background: t.accent, color: "#000" }}
              >
                {loginLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const bg = "bg-white/[0.025]";
  const border = "border border-white/5";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield size={18} style={{ color: t.accent }} />
            Admin Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Platform management & monitoring</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-admin-refresh"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] })}
          className="text-gray-500 hover:text-gray-300"
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 pb-0 flex gap-1 flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-admin-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: active ? t.accentFaded(0.1) : "transparent",
                color: active ? t.accent : "#6b7280",
                borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
              }}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── OVERVIEW ─────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {statsLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading stats…</div>
            ) : stats ? (
              <>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">Platform Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-500/15 text-blue-400" />
                  <StatCard label="Coins in Circulation" value={stats.totalCoinsInCirculation} icon={Coins} color="bg-yellow-500/15 text-yellow-400" />
                  <StatCard label="Bot Catalog" value={`${stats.activeBots} / ${stats.totalBots}`} sub="active / total" icon={Bot} color="bg-purple-500/15 text-purple-400" />
                  <StatCard label="Running Deployments" value={stats.runningDeployments} sub={`${stats.totalDeployments} total`} icon={Activity} color="bg-green-500/15 text-green-400" />
                  <StatCard label="Failed Deployments" value={stats.failedDeployments} icon={XCircle} color="bg-red-500/15 text-red-400" />
                  <StatCard label="Successful Payments" value={stats.successTransactions} sub={`${stats.totalTransactions} total`} icon={CreditCard} color="bg-emerald-500/15 text-emerald-400" />
                  <StatCard label="Total Revenue" value={`${(stats.totalRevenue / 100).toFixed(0)} units`} sub="minor currency units" icon={TrendingUp} color="bg-teal-500/15 text-teal-400" />
                  <StatCard label="Notifications" value={stats.totalNotifications} icon={Bell} color="bg-orange-500/15 text-orange-400" />
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── USERS ────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">All Users ({users.length})</h3>
            </div>
            {usersLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
            ) : users.length === 0 ? (
              <div className="text-gray-600 text-sm">No users have purchased coins yet.</div>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.userId} className={`${bg} ${border} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3`} data-testid={`row-user-${u.userId}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-300 truncate" title={u.userId}>{u.userId.slice(0, 8)}…{u.userId.slice(-6)}</span>
                        {u.isAdmin && <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Admin</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span><Coins size={10} className="inline mr-0.5" />{u.balance} coins</span>
                        <span><Rocket size={10} className="inline mr-0.5" />{u.deploymentCount} deployments</span>
                        <span><Activity size={10} className="inline mr-0.5" />{u.runningBots} running</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Coin adjust */}
                      <div className="flex items-center gap-1">
                        <Input
                          data-testid={`input-coins-${u.userId}`}
                          type="number"
                          placeholder="±coins"
                          className="w-20 h-7 text-xs bg-white/5 border-white/10"
                          value={coinInputs[u.userId] ?? ""}
                          onChange={e => setCoinInputs(prev => ({ ...prev, [u.userId]: e.target.value }))}
                        />
                        <Button
                          data-testid={`button-adjust-coins-${u.userId}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-white/10"
                          disabled={!coinInputs[u.userId] || adjustCoinsMutation.isPending}
                          onClick={() => {
                            const amt = parseInt(coinInputs[u.userId] ?? "0");
                            if (!isNaN(amt)) {
                              adjustCoinsMutation.mutate({ uid: u.userId, amount: amt });
                              setCoinInputs(prev => ({ ...prev, [u.userId]: "" }));
                            }
                          }}
                        >
                          <Check size={11} />
                        </Button>
                      </div>
                      {u.isAdmin && u.userId !== userId ? (
                        <Button
                          data-testid={`button-revoke-admin-${u.userId}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => revokeAdminMutation.mutate(u.userId)}
                          disabled={revokeAdminMutation.isPending}
                        >
                          <UserX size={11} className="mr-1" />Revoke
                        </Button>
                      ) : !u.isAdmin ? (
                        <Button
                          data-testid={`button-grant-admin-${u.userId}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => grantAdminMutation.mutate(u.userId)}
                          disabled={grantAdminMutation.isPending}
                        >
                          <UserCheck size={11} className="mr-1" />Grant
                        </Button>
                      ) : null}
                      {u.userId !== userId && (
                        <Button
                          data-testid={`button-delete-user-${u.userId}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => { if (confirm("Delete this user and all their data?")) deleteUserMutation.mutate(u.userId); }}
                          disabled={deleteUserMutation.isPending}
                        >
                          <Trash2 size={11} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BOT CATALOG ──────────────────────────────────── */}
        {activeTab === "bots" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Bot Catalog ({bots.length})</h3>
              <Button
                data-testid="button-add-bot"
                size="sm"
                onClick={() => setShowBotForm(v => !v)}
                style={{ background: t.accentFaded(0.15), color: t.accent, border: `1px solid ${t.accentFaded(0.3)}` }}
              >
                <Plus size={13} className="mr-1" /> Add Bot
              </Button>
            </div>

            {showBotForm && (
              <div className={`${bg} ${border} rounded-xl p-4 mb-4 space-y-3`}>
                <h4 className="text-sm font-semibold" style={{ color: t.accent }}>New Bot</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input data-testid="input-bot-name" placeholder="Bot Name" className="bg-white/5 border-white/10" value={botForm.name} onChange={e => setBotForm(p => ({ ...p, name: e.target.value }))} />
                  <Input data-testid="input-bot-category" placeholder="Category" className="bg-white/5 border-white/10" value={botForm.category} onChange={e => setBotForm(p => ({ ...p, category: e.target.value }))} />
                  <Input data-testid="input-bot-repo" placeholder="GitHub repo URL" className="bg-white/5 border-white/10 sm:col-span-2" value={botForm.repository} onChange={e => setBotForm(p => ({ ...p, repository: e.target.value }))} />
                  <Input data-testid="input-bot-logo" placeholder="Logo URL (optional)" className="bg-white/5 border-white/10 sm:col-span-2" value={botForm.logo} onChange={e => setBotForm(p => ({ ...p, logo: e.target.value }))} />
                  <Textarea data-testid="input-bot-description" placeholder="Description" className="bg-white/5 border-white/10 sm:col-span-2 resize-none h-20" value={botForm.description} onChange={e => setBotForm(p => ({ ...p, description: e.target.value }))} />
                  <Input data-testid="input-bot-keywords" placeholder="Keywords (comma separated)" className="bg-white/5 border-white/10 sm:col-span-2" value={botForm.keywords} onChange={e => setBotForm(p => ({ ...p, keywords: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="button-save-bot"
                    size="sm"
                    disabled={!botForm.name || !botForm.repository || !botForm.description || addBotMutation.isPending}
                    onClick={() => addBotMutation.mutate()}
                    style={{ background: t.accent, color: "#000" }}
                  >
                    {addBotMutation.isPending ? "Saving…" : "Save Bot"}
                  </Button>
                  <Button data-testid="button-cancel-bot" size="sm" variant="ghost" onClick={() => setShowBotForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {botsLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
            ) : bots.length === 0 ? (
              <div className="text-gray-600 text-sm">No bots in catalog.</div>
            ) : (
              <div className="space-y-2">
                {bots.map(bot => (
                  <div key={bot.id} className={`${bg} ${border} rounded-xl p-4 flex items-center gap-4`} data-testid={`row-bot-${bot.id}`}>
                    {bot.logo && <img src={bot.logo} alt={bot.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                    {!bot.logo && (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.accentFaded(0.1), border: `1px solid ${t.accentFaded(0.2)}` }}>
                        <Bot size={16} style={{ color: t.accent }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{bot.name}</span>
                        {bot.active ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-500/15 text-green-400 border-green-500/30">Active</Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 py-0 bg-gray-500/15 text-gray-400 border-gray-500/30">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{bot.description}</p>
                      <p className="text-xs text-gray-600 font-mono truncate">{bot.repository}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        data-testid={`button-toggle-bot-${bot.id}`}
                        size="sm"
                        variant="outline"
                        className={`h-7 text-xs ${bot.active ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}
                        onClick={() => toggleBotMutation.mutate({ id: bot.id, active: !bot.active })}
                        disabled={toggleBotMutation.isPending}
                      >
                        {bot.active ? <><EyeOff size={11} className="mr-1" />Hide</> : <><Eye size={11} className="mr-1" />Show</>}
                      </Button>
                      <Button
                        data-testid={`button-delete-bot-${bot.id}`}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Delete this bot from the catalog?")) deleteBotMutation.mutate(bot.id); }}
                        disabled={deleteBotMutation.isPending}
                      >
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DEPLOYMENTS ──────────────────────────────────── */}
        {activeTab === "deployments" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">All Deployments ({deployments.length})</h3>
              <Button variant="ghost" size="sm" className="text-gray-500 h-7 text-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] })}>
                <RefreshCw size={12} className="mr-1" /> Refresh
              </Button>
            </div>
            {deploymentsLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
            ) : deployments.length === 0 ? (
              <div className="text-gray-600 text-sm">No deployments on the platform yet.</div>
            ) : (
              <div className="space-y-2">
                {deployments.map(dep => (
                  <div key={dep.id} className={`${bg} ${border} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3`} data-testid={`row-deployment-${dep.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{dep.botName}</span>
                        <StatusBadge status={dep.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="font-mono">ID: {dep.id.slice(0, 8)}…</span>
                        {dep.userId && <span className="font-mono">User: {dep.userId.slice(0, 8)}…</span>}
                        <span>{new Date(dep.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {dep.status === "running" && (
                        <Button
                          data-testid={`button-stop-dep-${dep.id}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => stopDepMutation.mutate(dep.id)}
                          disabled={stopDepMutation.isPending}
                        >
                          <PowerOff size={11} className="mr-1" />Stop
                        </Button>
                      )}
                      <Button
                        data-testid={`button-delete-dep-${dep.id}`}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Delete this deployment?")) deleteDepMutation.mutate(dep.id); }}
                        disabled={deleteDepMutation.isPending}
                      >
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS ─────────────────────────────────────── */}
        {activeTab === "payments" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Payment Transactions ({payments.length})</h3>
            </div>
            {paymentsLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
            ) : payments.length === 0 ? (
              <div className="text-gray-600 text-sm">No payment transactions recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {payments.map(tx => (
                  <div key={tx.id} className={`${bg} ${border} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3`} data-testid={`row-payment-${tx.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={tx.status} />
                        <span className="font-semibold text-sm">{tx.currency} {(tx.amount / 100).toFixed(2)}</span>
                        <span className="text-xs text-yellow-400 font-mono">+{tx.coins} coins</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="font-mono">User: {tx.userId.slice(0, 8)}…</span>
                        {tx.provider && <span>via {tx.provider}</span>}
                        <span className="font-mono text-gray-600">{tx.reference.slice(0, 16)}…</span>
                        {tx.createdAt && <span>{new Date(tx.createdAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICATIONS ─────────────────────────────────── */}
        {activeTab === "notifications" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Notifications ({notifs.length})</h3>
              <Button
                data-testid="button-add-notification"
                size="sm"
                onClick={() => setShowNotifForm(v => !v)}
                style={{ background: t.accentFaded(0.15), color: t.accent, border: `1px solid ${t.accentFaded(0.3)}` }}
              >
                <Plus size={13} className="mr-1" /> New
              </Button>
            </div>

            {showNotifForm && (
              <div className={`${bg} ${border} rounded-xl p-4 mb-4 space-y-3`}>
                <h4 className="text-sm font-semibold" style={{ color: t.accent }}>Publish Notification</h4>
                <Input data-testid="input-notif-title" placeholder="Title" className="bg-white/5 border-white/10" value={notifForm.title} onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))} />
                <Textarea data-testid="input-notif-message" placeholder="Message" className="bg-white/5 border-white/10 resize-none h-24" value={notifForm.message} onChange={e => setNotifForm(p => ({ ...p, message: e.target.value }))} />
                <Select value={notifForm.type} onValueChange={v => setNotifForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger data-testid="select-notif-type" className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    data-testid="button-publish-notification"
                    size="sm"
                    disabled={!notifForm.title || !notifForm.message || addNotifMutation.isPending}
                    onClick={() => addNotifMutation.mutate()}
                    style={{ background: t.accent, color: "#000" }}
                  >
                    {addNotifMutation.isPending ? "Publishing…" : "Publish"}
                  </Button>
                  <Button data-testid="button-cancel-notification" size="sm" variant="ghost" onClick={() => setShowNotifForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {notifsLoading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
            ) : notifs.length === 0 ? (
              <div className="text-gray-600 text-sm">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {notifs.map(n => {
                  const typeColors: Record<string, string> = {
                    info: "border-l-blue-400",
                    warning: "border-l-yellow-400",
                    success: "border-l-green-400",
                    error: "border-l-red-400",
                  };
                  return (
                    <div key={n.id} className={`${bg} ${border} border-l-4 ${typeColors[n.type] ?? "border-l-gray-400"} rounded-xl p-4 flex items-start gap-3`} data-testid={`row-notification-${n.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{n.title}</span>
                          <Badge className="text-[10px] px-1.5 py-0 bg-gray-500/15 text-gray-400 border-gray-500/30 capitalize">{n.type}</Badge>
                          {n.active ? (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-500/15 text-green-400 border-green-500/30">Active</Badge>
                          ) : (
                            <Badge className="text-[10px] px-1.5 py-0 bg-gray-500/15 text-gray-400 border-gray-500/30">Hidden</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                        {n.createdAt && <p className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          data-testid={`button-toggle-notif-${n.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-500 hover:text-gray-300"
                          onClick={() => toggleNotifMutation.mutate({ id: n.id, active: !n.active })}
                        >
                          {n.active ? <EyeOff size={12} /> : <Eye size={12} />}
                        </Button>
                        <Button
                          data-testid={`button-delete-notif-${n.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => { if (confirm("Delete this notification?")) deleteNotifMutation.mutate(n.id); }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
