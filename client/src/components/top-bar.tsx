import { useState, useRef, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, ChevronDown, Bot, X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  active: boolean;
  createdAt: string | null;
};

const TYPE_ICON: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

const TYPE_COLOR: Record<string, string> = {
  info: "#4ade80",
  warning: "#f59e0b",
  success: "#4ade80",
  error: "#f87171",
};

export function TopBar() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);

  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const runningCount = deployments.filter(d => d.status === "running").length;
  const username = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "wolf";
  const initial = username[0]?.toUpperCase() || "W";
  const unreadCount = notifications.length;

  // Close panel when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  return (
    <header
      className="h-12 flex items-center justify-between px-4 flex-shrink-0 relative"
      style={{
        background: t.topbarBg,
        backdropFilter: t.backdropBlur,
        borderBottom: `1px solid ${t.accentFaded(0.1)}`,
      }}
    >
      <div className="flex items-center gap-3">
        <SidebarTrigger
          data-testid="button-sidebar-toggle"
          className="text-gray-500 hover:text-gray-300 transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Running count pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: t.accentFaded(0.08), border: `1px solid ${t.accentFaded(0.2)}` }}
        >
          <Bot className="w-3.5 h-3.5" style={{ color: t.accent }} />
          <span className="text-xs font-mono font-bold tracking-wider" style={{ color: t.accent }}>
            {runningCount} Running
          </span>
        </div>

        {/* Notifications bell */}
        <div ref={panelRef} className="relative">
          <button
            data-testid="button-notifications"
            onClick={() => setNotifOpen(v => !v)}
            className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold px-0.5"
                style={{ background: t.accent, color: "#000" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications dropdown */}
          {notifOpen && (
            <div
              className="absolute right-0 top-10 w-80 rounded-xl overflow-hidden z-50 shadow-xl"
              style={{ background: "rgba(8,8,8,0.97)", border: `1px solid ${t.accentFaded(0.2)}`, backdropFilter: "blur(16px)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${t.accentFaded(0.1)}` }}
              >
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: t.accent }}>
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold font-mono"
                      style={{ background: t.accentFaded(0.15), color: t.accent }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-gray-600 hover:text-gray-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-6 h-6 mx-auto mb-2 opacity-20" style={{ color: t.accent }} />
                    <p className="text-[10px] font-mono text-gray-600">No notifications</p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const Icon = TYPE_ICON[notif.type] || Info;
                    const color = TYPE_COLOR[notif.type] || t.accent;
                    return (
                      <div
                        key={notif.id}
                        data-testid={`notification-${notif.id}`}
                        className="px-4 py-3 hover:bg-white/5 transition-colors"
                        style={{ borderBottom: `1px solid ${t.accentFaded(0.06)}` }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1 rounded-md flex-shrink-0 mt-0.5" style={{ background: `${color}15` }}>
                            <Icon className="w-3 h-3" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-mono font-bold text-white leading-tight">{notif.title}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                            {notif.createdAt && (
                              <p className="text-[9px] font-mono text-gray-700 mt-1">
                                {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User button */}
        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{ background: t.accentFaded(0.08), border: `1px solid ${t.accentFaded(0.2)}` }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: t.accentFaded(0.2), border: `1px solid ${t.accentFaded(0.3)}` }}
          >
            <span className="text-[9px] font-display font-black" style={{ color: t.accent }}>{initial}</span>
          </div>
          <span className="text-xs font-mono text-gray-300 tracking-wider capitalize">{username}</span>
          <ChevronDown className="w-3 h-3 text-gray-600" />
        </button>
      </div>
    </header>
  );
}
