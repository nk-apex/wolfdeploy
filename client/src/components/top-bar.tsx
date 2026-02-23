import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Wallet, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";

export function TopBar() {
  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const runningCount = deployments.filter(d => d.status === "running").length;

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-background flex-shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground" />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 bg-card border border-card-border rounded px-3 py-1.5">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground tracking-wider">
            {runningCount} RUNNING
          </span>
        </div>

        <button
          data-testid="button-notifications"
          className="relative w-8 h-8 flex items-center justify-center text-muted-foreground rounded"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 bg-card border border-card-border rounded px-2.5 py-1.5"
        >
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary-foreground">U</span>
          </div>
          <span className="text-xs text-foreground tracking-wider">user</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
