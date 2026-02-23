import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Bot, Rocket, Settings, Wallet, Users, LogOut, Circle, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";

const navItems = [
  { title: "Command Center", url: "/", icon: LayoutDashboard },
  { title: "My Bots", url: "/bots", icon: Bot },
  { title: "Deploy Bot", url: "/deploy", icon: Rocket },
  { title: "Referrals", url: "/referrals", icon: Users },
  { title: "Billing", url: "/billing", icon: Wallet },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    refetchInterval: 6000,
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const runningCount = deployments.filter(d => d.status === "running").length;
  const username = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "wolf";
  const initial = username[0]?.toUpperCase() || "W";
  const isAdmin = adminCheck?.isAdmin ?? false;

  const renderNavItem = (item: { title: string; url: string; icon: any }) => {
    const isActive =
      item.url === "/"
        ? location === "/"
        : location.startsWith(item.url) && item.url !== "/";
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <Link
            href={item.url}
            data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono tracking-wide transition-all cursor-pointer relative overflow-hidden"
            style={
              isActive
                ? {
                    background: t.accentFaded(0.08),
                    border: `1px solid ${t.accentFaded(0.18)}`,
                    color: t.accent,
                    boxShadow: `inset 0 0 20px ${t.accentFaded(0.03)}`,
                  }
                : {
                    border: "1px solid transparent",
                    color: "rgba(107,114,128,1)",
                  }
            }
          >
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                style={{ background: t.accentFaded(0.7) }}
              />
            )}
            <item.icon
              className="w-4 h-4 flex-shrink-0 transition-colors"
              style={{ color: isActive ? t.accent : undefined }}
            />
            <span className="flex-1 leading-none">{item.title}</span>
            {isActive && (
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: t.accentFaded(0.8) }} />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      className="border-r"
      style={{
        background: t.sidebarBg,
        backdropFilter: t.backdropBlur,
        borderColor: t.accentFaded(0.1),
      }}
    >
      {/* Logo */}
      <SidebarHeader className="px-4 pt-5 pb-4" style={{ borderBottom: `1px solid ${t.accentFaded(0.08)}` }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-black text-base"
            style={{
              background: `linear-gradient(135deg, ${t.accentFaded(0.2)} 0%, ${t.accentFaded(0.06)} 100%)`,
              border: `1px solid ${t.accentFaded(0.35)}`,
              color: t.accent,
              boxShadow: `0 0 12px ${t.accentFaded(0.08)}`,
            }}
          >
            W
          </div>
          <div>
            <span className="font-display font-black tracking-widest text-sm uppercase block leading-tight" style={{ color: t.accent }}>
              WolfDeploy
            </span>
            <span className="text-[9px] text-gray-600 font-mono tracking-widest uppercase">v1.0.0</span>
          </div>
        </div>
      </SidebarHeader>

      {/* Status pill */}
      {runningCount > 0 && (
        <div className="px-4 pt-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: t.accentFaded(0.06), border: `1px solid ${t.accentFaded(0.15)}` }}
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: t.accent }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: t.accent }} />
            </span>
            <span className="text-[10px] font-mono tracking-widest" style={{ color: t.accent }}>
              {runningCount} BOT{runningCount !== 1 ? "S" : ""} ONLINE
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <SidebarContent className="px-3 py-4 flex-1">
        <SidebarGroup>
          <p className="text-[9px] font-mono uppercase tracking-[0.18em] px-2 mb-2" style={{ color: t.accentFaded(0.35) }}>Navigation</p>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin section — only visible to admins */}
        {isAdmin && (
          <SidebarGroup className="mt-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] px-2 mb-2" style={{ color: t.accentFaded(0.35) }}>Admin</p>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {renderNavItem({ title: "Wolf Panel", url: "/wolf", icon: Shield })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-4 py-4" style={{ borderTop: `1px solid ${t.accentFaded(0.06)}` }}>
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl mb-3"
          style={{ background: t.accentFaded(0.05), border: `1px solid ${t.accentFaded(0.1)}` }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-black text-xs"
            style={{ background: t.accentFaded(0.15), border: `1px solid ${t.accentFaded(0.3)}`, color: t.accent }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white font-mono font-bold leading-tight truncate capitalize">{username}</p>
            <p className="text-[9px] font-mono leading-tight truncate" style={{ color: t.accentFaded(isAdmin ? 0.7 : 0.3) }}>
              {isAdmin ? "Administrator" : "Free Plan"}
            </p>
          </div>
          <Circle className="w-2 h-2 flex-shrink-0" style={{ color: t.accent, fill: t.accent }} />
        </div>
        <button
          data-testid="button-sign-out"
          onClick={async () => { await signOut(); navigate("/login"); }}
          className="w-full flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest hover:text-gray-400 transition-colors cursor-pointer px-1"
          style={{ color: t.accentFaded(0.4) }}
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
