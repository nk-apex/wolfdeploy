import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import Dashboard from "@/pages/dashboard";
import Deploy from "@/pages/deploy";
import MyBots from "@/pages/my-bots";
import BotLogs from "@/pages/bot-logs";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/deploy" component={Deploy} />
      <Route path="/deploy/:botId" component={Deploy} />
      <Route path="/bots" component={MyBots} />
      <Route path="/bots/:id/logs" component={BotLogs} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties} defaultOpen={true}>
          <div className="flex h-screen w-full overflow-hidden" style={{ background: "#080808" }}>
            {/* Subtle grid background */}
            <div
              className="fixed inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(74,222,128,0.02) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(74,222,128,0.02) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
              }}
            />
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0 relative z-10">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
