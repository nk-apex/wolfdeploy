import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, ChevronDown, Bot } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";

export function TopBar() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const runningCount = deployments.filter(d => d.status === "running").length;
  const username = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "wolf";
  const initial = username[0]?.toUpperCase() || "W";

  return (
    <header
      className="h-12 flex items-center justify-between px-4 flex-shrink-0"
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
          style={{
            background: t.accentFaded(0.08),
            border: `1px solid ${t.accentFaded(0.2)}`,
          }}
        >
          <Bot className="w-3.5 h-3.5" style={{ color: t.accent }} />
          <span className="text-xs font-mono font-bold tracking-wider" style={{ color: t.accent }}>
            {runningCount} Running
          </span>
        </div>

        {/* Notifications */}
        <button
          data-testid="button-notifications"
          className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {deployments.length > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
          )}
        </button>

        {/* User */}
        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{
            background: t.accentFaded(0.08),
            border: `1px solid ${t.accentFaded(0.2)}`,
          }}
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
