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
    <header className="h-12 border-b border-primary/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="text-gray-500 hover:text-gray-300" />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono text-primary font-bold">
            {runningCount} Running
          </span>
        </div>

        <button
          data-testid="button-notifications"
          className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5 hover:border-primary/40 transition-all"
        >
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-[9px] font-display font-bold text-primary">U</span>
          </div>
          <span className="text-xs font-mono text-gray-300">user</span>
          <ChevronDown className="w-3 h-3 text-gray-600" />
        </button>
      </div>
    </header>
  );
}
