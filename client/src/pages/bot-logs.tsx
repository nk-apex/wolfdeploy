import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deployment } from "@shared/schema";
import { StatusBadge } from "@/components/status-badge";
import {
  ScrollText, ArrowLeft, StopCircle, Trash2, ExternalLink,
  RefreshCw, Terminal, Clock, Cpu, MemoryStick, Bot
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const LOG_COLORS: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-yellow-400",
  error: "text-red-400",
  success: "text-primary",
};

const LOG_PREFIX: Record<string, string> = {
  info: "[INFO ]",
  warn: "[WARN ]",
  error: "[ERROR]",
  success: "[  OK ]",
};

export default function BotLogs() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: deployment, isLoading } = useQuery<Deployment>({
    queryKey: ["/api/deployments", id],
    queryFn: async () => {
      const res = await fetch(`/api/deployments/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchInterval: (query) => {
      const dep = query.state.data as Deployment | undefined;
      if (dep && (dep.status === "running" || dep.status === "stopped" || dep.status === "failed")) {
        return 8000;
      }
      return 1500;
    },
  });

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [deployment?.logs?.length]);

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/deployments/${id}/stop`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({ title: "Bot stopped" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/deployments/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      navigate("/bots");
      toast({ title: "Deployment deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-6 text-center py-24">
        <p className="text-sm text-muted-foreground">Deployment not found.</p>
        <Link href="/bots">
          <Button variant="outline" className="mt-4 text-xs tracking-wider">Back to My Bots</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bots">
          <button
            data-testid="button-back"
            className="w-8 h-8 flex items-center justify-center text-muted-foreground rounded border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-primary tracking-wider flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              {deployment.botName}
            </h1>
            <StatusBadge status={deployment.status} />
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {deployment.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="button-refresh"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/deployments", id] })}
            className="gap-1.5 text-[9px] tracking-widest uppercase h-7 px-2"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
          {deployment.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              data-testid="button-stop"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="gap-1.5 text-[9px] tracking-widest uppercase h-7 px-2 text-yellow-500 border-yellow-500/30"
            >
              <StopCircle className="w-3 h-3" />
              Stop
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                data-testid="button-delete"
                className="gap-1.5 text-[9px] tracking-widest uppercase h-7 px-2 text-red-400 border-red-400/30"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-card-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-sm tracking-wide">Delete Deployment</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  This will permanently delete the deployment. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground text-xs"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "URL",
            value: deployment.url ? (
              <a href={deployment.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary">
                <ExternalLink className="w-3 h-3" />
                <span className="truncate">{deployment.url.replace("https://", "")}</span>
              </a>
            ) : "—",
            icon: Bot,
          },
          {
            label: "CREATED",
            value: formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true }),
            icon: Clock,
          },
          {
            label: "CPU",
            value: deployment.metrics ? deployment.metrics.cpu.toFixed(1) + "%" : "—",
            icon: Cpu,
          },
          {
            label: "MEMORY",
            value: deployment.metrics ? deployment.metrics.memory.toFixed(0) + " MB" : "—",
            icon: MemoryStick,
          },
        ].map((item) => (
          <Card key={item.label} className="p-3 border-card-border bg-card">
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon className="w-3 h-3 text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">{item.label}</p>
            </div>
            <div className="text-[11px] text-foreground font-mono font-bold truncate">{item.value}</div>
          </Card>
        ))}
      </div>

      {/* Logs Terminal */}
      <Card className="border-card-border bg-card">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-foreground">Deployment Logs</span>
            <span className="text-[9px] text-muted-foreground">({deployment.logs.length} entries)</span>
          </div>
          {(deployment.status === "deploying" || deployment.status === "queued") && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] text-primary tracking-wider uppercase">Live</span>
            </div>
          )}
        </div>

        <div className="h-80 overflow-y-auto bg-background/60 p-4 font-mono">
          {deployment.logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted-foreground">
                {deployment.status === "queued" ? "Waiting for deployment to start..." : "No logs yet."}
              </p>
            </div>
          ) : (
            deployment.logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 mb-1 group">
                <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 mt-0.5 tracking-wide">
                  {format(new Date(log.timestamp), "HH:mm:ss")}
                </span>
                <span className={`text-[10px] flex-shrink-0 font-bold ${LOG_COLORS[log.level]}`}>
                  {LOG_PREFIX[log.level]}
                </span>
                <span className={`text-[11px] leading-relaxed ${LOG_COLORS[log.level]}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          {(deployment.status === "deploying" || deployment.status === "queued") && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-primary">$</span>
              <span className="w-2 h-3.5 bg-primary animate-pulse" />
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </Card>

      {/* Env vars (masked) */}
      <Card className="border-card-border bg-card p-4">
        <h3 className="text-[10px] font-bold tracking-widest uppercase text-foreground mb-3 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-primary" />
          Config Variables
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(deployment.envVars).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 bg-background/50 rounded px-2.5 py-2 border border-border">
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider flex-shrink-0">{key}</span>
              <span className="text-[10px] font-mono text-muted-foreground/60 truncate flex-1">
                {key.includes("KEY") || key.includes("SECRET")
                  ? "••••••••••••"
                  : value}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
