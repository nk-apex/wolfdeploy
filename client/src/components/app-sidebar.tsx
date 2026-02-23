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
import { LayoutDashboard, Bot, Rocket, Settings, Wallet, Users, LogOut, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";

const navItems = [
  { title: "Command Center", url: "/", icon: LayoutDashboard },
  { title: "My Bots", url: "/bots", icon: Bot },
  { title: "Deploy Bot", url: "/deploy", icon: Rocket },
  { title: "Referrals", url: "/", icon: Users },
  { title: "Billing", url: "/", icon: Wallet },
  { title: "Settings", url: "/", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    refetchInterval: 6000,
  });

  const runningCount = deployments.filter(d => d.status === "running").length;

  return (
    <Sidebar
      className="border-r border-primary/10"
      style={{ background: "rgba(4,4,4,0.92)", backdropFilter: "blur(16px)" }}
    >
      {/* Logo */}
      <SidebarHeader className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-black text-base"
            style={{
              background: "linear-gradient(135deg, rgba(74,222,128,0.2) 0%, rgba(74,222,128,0.06) 100%)",
              border: "1px solid rgba(74,222,128,0.35)",
              color: "hsl(142 76% 42%)",
              boxShadow: "0 0 12px rgba(74,222,128,0.08)",
            }}
          >
            B
          </div>
          <div>
            <span className="font-display font-black tracking-widest text-primary text-sm uppercase block leading-tight">
              BotForge
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
            style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[10px] font-mono text-primary tracking-widest">
              {runningCount} BOT{runningCount !== 1 ? "S" : ""} ONLINE
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <SidebarContent className="px-3 py-4 flex-1">
        <SidebarGroup>
          <p className="text-[9px] text-gray-700 font-mono uppercase tracking-[0.18em] px-2 mb-2">Navigation</p>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
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
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono tracking-wide transition-all cursor-pointer relative overflow-hidden ${
                          isActive ? "text-primary" : "text-gray-500 hover:text-gray-200"
                        }`}
                        style={
                          isActive
                            ? {
                                background: "rgba(74,222,128,0.08)",
                                border: "1px solid rgba(74,222,128,0.18)",
                                boxShadow: "inset 0 0 20px rgba(74,222,128,0.03)",
                              }
                            : {
                                border: "1px solid transparent",
                              }
                        }
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                            style={{ background: "rgba(74,222,128,0.7)" }}
                          />
                        )}
                        <item.icon
                          className={`w-4 h-4 flex-shrink-0 transition-colors ${
                            isActive ? "text-primary" : "text-gray-700 group-hover:text-gray-400"
                          }`}
                        />
                        <span className="flex-1 leading-none">{item.title}</span>
                        {isActive && (
                          <div
                            className="w-1 h-1 rounded-full flex-shrink-0"
                            style={{ background: "rgba(74,222,128,0.8)" }}
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-4 py-4 border-t border-white/5">
        {/* User row */}
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl mb-3"
          style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-black text-xs"
            style={{
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.3)",
              color: "hsl(142 76% 42%)",
            }}
          >
            W
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white font-mono font-bold leading-tight truncate">wolf</p>
            <p className="text-[9px] text-gray-600 font-mono leading-tight truncate">Free Plan</p>
          </div>
          <Circle className="w-2 h-2 text-primary fill-primary flex-shrink-0" />
        </div>
        <button
          data-testid="button-sign-out"
          className="w-full flex items-center gap-2 text-[9px] text-gray-600 font-mono uppercase tracking-widest hover:text-gray-400 transition-colors cursor-pointer px-1"
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
