import { Switch, Route, useLocation } from "wouter";
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
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEffect } from "react";

const AUTH_PAGES = ["/login", "/signup", "/"];

function AppShell() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  const isPublicPage = location === "/" || location === "/login" || location === "/signup";

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      navigate("/login");
    }
  }, [loading, user, isPublicPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
            style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "hsl(142 76% 42%)" }}
          >
            W
          </div>
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Loading WolfDeploy…</p>
        </div>
      </div>
    );
  }

  // Public routes — no sidebar
  if (!user) {
    if (location === "/login") return <Login />;
    if (location === "/signup") return <Signup />;
    return <Landing />;
  }

  // Logged-in user landed on a public page (e.g. after email confirmation redirect to /login)
  if (location === "/login" || location === "/signup") {
    navigate("/");
    return null;
  }

  // Authenticated app shell
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}
      defaultOpen={true}
    >
      <div className="flex h-screen w-full overflow-hidden" style={{ background: "#080808" }}>
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
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/deploy" component={Deploy} />
              <Route path="/deploy/:botId" component={Deploy} />
              <Route path="/bots" component={MyBots} />
              <Route path="/bots/:id/logs" component={BotLogs} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppShell />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
