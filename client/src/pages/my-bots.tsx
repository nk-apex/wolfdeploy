import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deployment } from "@shared/schema";
import { StatusBadge } from "@/components/status-badge";
import {
  Bot, Rocket, Plus, ScrollText, StopCircle, Trash2,
  ExternalLink, Clock, Cpu, MemoryStick, Activity
} from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      {label && <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">{label}</p>}
    </div>
  );
}

export default function MyBots() {
  const { toast } = useToast();
  const { data: deployments = [], isLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    refetchInterval: 5000,
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/deployments/${id}/stop`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({ title: "Bot stopped successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deployments/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({ title: "Deployment deleted" });
    },
  });

  if (isLoading) return <Spinner label="Loading your bots…" />;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-wrap justify-between items-end gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">My Bots</h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">
            {deployments.length} deployment{deployments.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/deploy">
          <button
            className="group px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all"
            data-testid="button-new-deployment"
          >
            <div className="flex items-center text-xs sm:text-sm font-mono text-primary">
              <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
              New Deployment
            </div>
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 rounded-xl bg-black/30 border border-primary/10 animate-pulse" />
          ))}
        </div>
      ) : deployments.length === 0 ? (
        <div className="p-8 sm:p-16 rounded-xl border border-dashed border-primary/20 bg-black/20 text-center">
          <div className="p-4 bg-primary/10 rounded-xl w-fit mx-auto mb-4">
            <Bot className="w-8 h-8 text-primary/50" />
          </div>
          <p className="font-display font-bold text-white text-sm sm:text-base mb-1">No deployments yet</p>
          <p className="text-xs text-gray-500 font-mono mb-5">Deploy your first WhatsApp bot to get started</p>
          <Link href="/deploy">
            <button
              className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all"
              data-testid="button-deploy-first"
            >
              <div className="flex items-center gap-2 text-sm font-mono text-primary">
                <Rocket className="w-4 h-4" />
                Deploy a Bot
              </div>
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {deployments.map((dep) => (
            <div
              key={dep.id}
              data-testid={`deployment-card-${dep.id}`}
              className="p-4 sm:p-5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm hover:border-primary/30 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-white">{dep.botName}</p>
                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">{dep.id.slice(0, 16)}...</p>
                  </div>
                </div>
                <StatusBadge status={dep.status} />
              </div>

              {/* URL */}
              {dep.url && (
                <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 border border-primary/10 mb-3">
                  <ExternalLink className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="text-[10px] font-mono text-gray-500 truncate flex-1">{dep.url}</span>
                  <a href={dep.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary font-mono flex-shrink-0 hover:underline">
                    OPEN
                  </a>
                </div>
              )}

              {/* Metrics */}
              {dep.metrics && dep.status === "running" && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "CPU", value: dep.metrics.cpu.toFixed(1) + "%", icon: Cpu },
                    { label: "RAM", value: dep.metrics.memory.toFixed(0) + "MB", icon: MemoryStick },
                    { label: "REQ", value: String(dep.metrics.requests), icon: Activity },
                  ].map((m) => (
                    <div key={m.label} className="p-2 rounded-lg border border-primary/10 bg-black/20">
                      <div className="flex items-center gap-1 mb-1">
                        <m.icon className="w-2.5 h-2.5 text-gray-600" />
                        <span className="text-[8px] text-gray-600 font-mono uppercase tracking-widest">{m.label}</span>
                      </div>
                      <p className="text-xs font-display font-bold text-white">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-primary/10">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/bots/${dep.id}/logs`}>
                    <button
                      data-testid={`button-logs-${dep.id}`}
                      className="flex items-center gap-1 text-[9px] text-primary font-mono px-2 py-1 border border-primary/20 rounded hover:border-primary/40 transition-all"
                    >
                      <ScrollText className="w-3 h-3" />
                      Logs
                    </button>
                  </Link>
                  {dep.status === "running" && (
                    <button
                      data-testid={`button-stop-${dep.id}`}
                      onClick={() => stopMutation.mutate(dep.id)}
                      disabled={stopMutation.isPending}
                      className="flex items-center gap-1 text-[9px] text-yellow-400 font-mono px-2 py-1 border border-yellow-500/20 rounded hover:border-yellow-500/40 transition-all disabled:opacity-50"
                    >
                      <StopCircle className="w-3 h-3" />
                      Stop
                    </button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        data-testid={`button-delete-${dep.id}`}
                        className="flex items-center gap-1 text-[9px] text-red-400 font-mono px-2 py-1 border border-red-500/20 rounded hover:border-red-500/40 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-black/90 border-primary/20 backdrop-blur-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white font-display">Delete Deployment</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 font-mono text-xs">
                          Delete <span className="text-white">{dep.botName}</span>? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-primary/20 text-gray-400 font-mono text-xs bg-transparent">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(dep.id)}
                          className="bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs hover:bg-red-500/20"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
