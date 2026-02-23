import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, ChevronDown, Bot } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment } from "@shared/schema";
import { Link } from "wouter";

export function TopBar() {
  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const runningCount = deployments.filter(d => d.status === "running").length;

  return (
    <header
      className="h-12 flex items-center justify-between px-4 flex-shrink-0"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(74,222,128,0.1)",
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
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono text-primary font-bold tracking-wider">
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
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </button>

        {/* User */}
        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.3)" }}
          >
            <span className="text-[9px] font-display font-black text-primary">W</span>
          </div>
          <span className="text-xs font-mono text-gray-300 tracking-wider">wolf</span>
          <ChevronDown className="w-3 h-3 text-gray-600" />
        </button>
      </div>
    </header>
  );
}
