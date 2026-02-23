import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
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

const LOG_COLORS: Record<string, string> = {
  info: "text-gray-400",
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
      if (!dep || dep.status === "stopped" || dep.status === "failed") return 8000;
      if (dep.status === "running") return 2000;
      return 1200;
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
      <div className="p-4 sm:p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-black/30 border border-primary/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-4 sm:p-6 text-center py-24">
        <p className="text-sm text-gray-500 font-mono">Deployment not found.</p>
        <Link href="/bots">
          <button className="mt-4 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg text-xs font-mono text-primary hover:bg-primary/20 transition-all">
            Back to My Bots
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start gap-3">
        <Link href="/bots">
          <button
            data-testid="button-back"
            className="p-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-3 mb-1">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary" />
              {deployment.botName}
            </h1>
            <StatusBadge status={deployment.status} />
          </div>
          <p className="text-[10px] text-gray-600 font-mono">ID: {deployment.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            data-testid="button-refresh"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/deployments", id] })}
            className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono px-2.5 py-1.5 border border-primary/20 rounded-lg hover:border-primary/40 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          {deployment.status === "running" && (
            <button
              data-testid="button-stop"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="flex items-center gap-1.5 text-[9px] text-yellow-400 font-mono px-2.5 py-1.5 border border-yellow-500/20 rounded-lg hover:border-yellow-500/40 transition-all disabled:opacity-50"
            >
              <StopCircle className="w-3 h-3" />
              Stop
            </button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                data-testid="button-delete"
                className="flex items-center gap-1.5 text-[9px] text-red-400 font-mono px-2.5 py-1.5 border border-red-500/20 rounded-lg hover:border-red-500/40 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black/90 border-primary/20 backdrop-blur-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white font-display">Delete Deployment</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-500 font-mono text-xs">
                  This will permanently delete the deployment. Cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-primary/20 text-gray-400 font-mono text-xs bg-transparent">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: "URL", value: deployment.url?.replace("https://", "") || "—", icon: ExternalLink, href: deployment.url },
          { label: "Created", value: formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true }), icon: Clock },
          { label: "CPU", value: deployment.metrics ? deployment.metrics.cpu.toFixed(1) + "%" : "—", icon: Cpu },
          { label: "Memory", value: deployment.metrics ? deployment.metrics.memory.toFixed(0) + " MB" : "—", icon: MemoryStick },
        ].map((item) => (
          <div key={item.label} className="p-3 sm:p-4 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <item.icon className="w-3 h-3 text-gray-600" />
              <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">{item.label}</p>
            </div>
            {item.href ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer"
                className="text-[10px] sm:text-xs text-primary font-mono font-bold truncate block hover:underline">
                {item.value}
              </a>
            ) : (
              <p className="text-[10px] sm:text-xs text-white font-display font-bold truncate">{item.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Terminal Logs */}
      <div className="rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono text-white font-bold">Deployment Logs</span>
            <span className="text-[9px] text-gray-600 font-mono">({deployment.logs.length} entries)</span>
          </div>
          {(deployment.status === "deploying" || deployment.status === "queued" || deployment.status === "running") && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] text-primary font-mono uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>

        <div className="h-72 sm:h-80 overflow-y-auto p-4 bg-black/50 font-mono">
          {deployment.logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px] text-gray-600 font-mono">
                {deployment.status === "queued" ? "Waiting for deployment to start..." : "No logs yet."}
              </p>
            </div>
          ) : (
            deployment.logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 mb-1">
                <span className="text-[9px] text-gray-700 flex-shrink-0 mt-0.5">
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
      </div>

      {/* Config vars */}
      <div className="p-4 sm:p-5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm">
        <h3 className="text-xs font-bold text-white font-mono mb-3 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-primary" />
          Config Variables
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(deployment.envVars).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2 border border-primary/10">
              <span className="text-[9px] text-gray-500 font-mono font-bold uppercase tracking-widest flex-shrink-0">{key}</span>
              <span className="text-[10px] font-mono text-gray-600 truncate flex-1">
                {key.includes("KEY") || key.includes("SECRET") ? "••••••••••••" : value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
