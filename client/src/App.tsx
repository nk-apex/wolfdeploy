import { Switch, Route, useLocation } from "wouter";
import { queryClient, setCurrentUserId } from "./lib/queryClient";
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
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Referrals from "@/pages/referrals";
import Admin from "@/pages/admin";
import Verify from "@/pages/verify";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme, getThemeTokens } from "@/lib/theme";
import { useEffect } from "react";

function AppShell() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const [location, navigate] = useLocation();

  const isPublicPage = location === "/" || location === "/login" || location === "/signup" || location === "/verify";

  // Set synchronously so queries fired during this render include the header
  setCurrentUserId(user?.id ?? "");

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      navigate("/login");
    }
  }, [loading, user, isPublicPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bg }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
            style={{ background: t.accentFaded(0.15), border: `1px solid ${t.accentFaded(0.35)}`, color: t.accent }}
          >
            W
          </div>
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${t.accentFaded(0.3)} transparent transparent transparent` }} />
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Loading WolfDeploy…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location === "/login") return <Login />;
    if (location === "/signup") return <Signup />;
    if (location === "/verify") return <Verify />;
    return <Landing />;
  }

  if (location === "/login" || location === "/signup") {
    navigate("/");
    return null;
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}
      defaultOpen={true}
    >
      <div className="flex h-screen w-full overflow-hidden" style={{ background: t.bg }}>
        {/* Ambient blobs (glass / neon themes) */}
        <div className="glass-blob-1" />
        <div className="glass-blob-2" />
        <div className="glass-blob-3" />

        {/* Grid overlay */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(${t.gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${t.gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            zIndex: 0,
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
              <Route path="/billing" component={Billing} />
              <Route path="/settings" component={Settings} />
              <Route path="/referrals" component={Referrals} />
              <Route path="/wolf" component={Admin} />
              <Route path="/verify" component={Verify} />
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
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
