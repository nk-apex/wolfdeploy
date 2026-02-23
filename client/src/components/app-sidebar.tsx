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
import { LayoutDashboard, Bot, Rocket, Settings, Wallet, Users, BarChart3, LogOut } from "lucide-react";

const navItems = [
  { title: "Command Center", url: "/", icon: LayoutDashboard },
  { title: "My Bots", url: "/bots", icon: Bot },
  { title: "Deploy Bot", url: "/deploy", icon: Rocket },
  { title: "Analytics", url: "/bots", icon: BarChart3 },
  { title: "Referrals", url: "/", icon: Users },
  { title: "Wallet", url: "/", icon: Wallet },
  { title: "Settings", url: "/", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-widest text-primary uppercase">BotForge</span>
            <span className="text-[10px] text-muted-foreground tracking-wider uppercase">Deploy Platform</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = item.url === "/"
                  ? location === "/"
                  : location.startsWith(item.url) && item.url !== "/";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs tracking-wider uppercase font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground"
                        }`}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                        <span>{item.title}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
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

      <SidebarFooter className="p-4 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-muted-foreground tracking-wider uppercase">Logged in as</span>
          <span className="text-[10px] text-foreground tracking-wider uppercase font-bold">user</span>
        </div>
        <button
          data-testid="button-sign-out"
          className="flex items-center gap-2 text-[10px] text-muted-foreground tracking-wider uppercase cursor-pointer"
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
