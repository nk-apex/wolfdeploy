import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
      toast({ title: "Bot stopped", description: "Your bot has been stopped successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to stop the bot.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deployments/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({ title: "Deployment deleted", description: "The deployment has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete the deployment.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary tracking-wider flex items-center gap-2">
            <Bot className="w-5 h-5" />
            My Bots
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">
            {deployments.length} deployment{deployments.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/deploy">
          <Button data-testid="button-new-deployment" className="gap-2 tracking-widest text-xs uppercase">
            <Plus className="w-3.5 h-3.5" />
            New Deployment
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-md" />)}
        </div>
      ) : deployments.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-full border border-border bg-card flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground tracking-wide mb-1">No deployments yet</p>
          <p className="text-xs text-muted-foreground tracking-wide mb-5">Deploy your first WhatsApp bot to get started</p>
          <Link href="/deploy">
            <Button data-testid="button-deploy-first" className="gap-2 tracking-widest text-xs uppercase">
              <Rocket className="w-3.5 h-3.5" />
              Deploy a Bot
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deployments.map((dep) => (
            <Card
              key={dep.id}
              data-testid={`deployment-card-${dep.id}`}
              className="p-4 border-card-border bg-card space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground tracking-wide">{dep.botName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{dep.id.slice(0, 16)}...</p>
                  </div>
                </div>
                <StatusBadge status={dep.status} />
              </div>

              {/* URL */}
              {dep.url && (
                <div className="flex items-center gap-2 bg-background/50 rounded px-2.5 py-1.5 border border-border">
                  <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{dep.url}</span>
                  <a href={dep.url} target="_blank" rel="noopener noreferrer">
                    <span className="text-[9px] text-primary tracking-wider">OPEN</span>
                  </a>
                </div>
              )}

              {/* Metrics */}
              {dep.metrics && dep.status === "running" && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "CPU", value: dep.metrics.cpu.toFixed(1) + "%", icon: Cpu },
                    { label: "RAM", value: dep.metrics.memory.toFixed(0) + "MB", icon: MemoryStick },
                    { label: "REQ", value: dep.metrics.requests.toString(), icon: Activity },
                  ].map((m) => (
                    <div key={m.label} className="bg-background/50 rounded px-2 py-1.5 border border-border">
                      <div className="flex items-center gap-1 mb-0.5">
                        <m.icon className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground tracking-widest uppercase">{m.label}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground font-mono">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/bots/${dep.id}/logs`}>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-logs-${dep.id}`}
                      className="gap-1.5 text-[9px] tracking-widest uppercase h-7 px-2"
                    >
                      <ScrollText className="w-3 h-3" />
                      Logs
                    </Button>
                  </Link>
                  {dep.status === "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-stop-${dep.id}`}
                      onClick={() => stopMutation.mutate(dep.id)}
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
                        data-testid={`button-delete-${dep.id}`}
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
                          Are you sure you want to delete <span className="text-foreground font-bold">{dep.botName}</span>?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs tracking-wider">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(dep.id)}
                          className="bg-destructive text-destructive-foreground text-xs tracking-wider"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
