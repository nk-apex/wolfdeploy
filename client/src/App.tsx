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
import RegisterBot from "@/pages/register-bot";
import Community from "@/pages/community";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme, getThemeTokens } from "@/lib/theme";
import { useEffect, Component, type ReactNode } from "react";
import { initSecurity } from "@/lib/security";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ui-crash]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#fff", fontFamily: "monospace", padding: "2rem", flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "2rem" }}>⚠</div>
          <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>Something went wrong</div>
          <div style={{ color: "#888", fontSize: "0.8rem", maxWidth: "500px", textAlign: "center" }}>
            {(this.state.error as Error).message}
          </div>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: "1rem", padding: "0.5rem 1.5rem", borderRadius: "8px", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer", fontFamily: "monospace" }}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const [location, navigate] = useLocation();

  const isPublicPage = location === "/" || location === "/login" || location === "/signup" || location === "/verify";

  // Set synchronously so queries fired during this render include the header
  setCurrentUserId(user?.id ?? "");

  // When the logged-in user changes (switch accounts), wipe the entire cache so
  // no previous user's data leaks into the new session.
  useEffect(() => {
    queryClient.clear();
  }, [user?.id]);

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
              <Route path="/register-bot" component={RegisterBot} />
              <Route path="/community" component={Community} />
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
    initSecurity();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <AppShell />
              <Toaster />
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
