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
import { LayoutDashboard, Bot, Rocket, Settings, Wallet, Users, LogOut } from "lucide-react";

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

  return (
    <Sidebar className="border-r border-primary/10" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
      {/* Logo */}
      <SidebarHeader className="px-4 py-4 border-b border-primary/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-black text-sm"
            style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "hsl(142 76% 42%)" }}
          >
            W
          </div>
          <span className="font-display font-bold tracking-widest text-primary text-sm uppercase">
            BotForge
          </span>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
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
                        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer ${
                          isActive
                            ? "text-primary"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                        style={
                          isActive
                            ? {
                                background: "rgba(74,222,128,0.08)",
                                border: "1px solid rgba(74,222,128,0.2)",
                              }
                            : { border: "1px solid transparent" }
                        }
                      >
                        <item.icon
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-gray-600 group-hover:text-gray-400"}`}
                        />
                        <span className="flex-1">{item.title}</span>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
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
      <SidebarFooter className="p-4 border-t border-primary/10">
        <div className="mb-2.5">
          <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest">LOGGED IN AS</span>
          <span className="text-[9px] text-white font-mono font-bold ml-2 tracking-widest">user</span>
        </div>
        <button
          data-testid="button-sign-out"
          className="flex items-center gap-1.5 text-[9px] text-gray-600 font-mono uppercase tracking-widest hover:text-gray-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
