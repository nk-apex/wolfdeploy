import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme, getThemeTokens } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Lock, Globe, AlertCircle, RefreshCw, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  message: string;
  createdAt: string;
};

type CommentForm = { subject: string; message: string };

export default function Community() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = getThemeTokens(theme);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"chat" | "feedback">("chat");
  const [chatInput, setChatInput] = useState("");
  const [subject, setSubject] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const username = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "wolf";

  const { data: chatStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/chat/status"],
    refetchInterval: 30000,
  });

  const { data: chatData, isLoading: chatLoading } = useQuery<{ messages: ChatMessage[]; enabled: boolean }>({
    queryKey: ["/api/chat/messages"],
    enabled: !!user && chatStatus?.enabled !== false,
    refetchInterval: 4000,
  });

  const messages = chatData?.messages ?? [];
  const chatEnabled = chatStatus?.enabled !== false && chatData?.enabled !== false;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = useMutation({
    mutationFn: () => apiRequest("POST", "/api/chat/messages", { message: chatInput.trim(), username }),
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err?.message || "Could not send message", variant: "destructive" });
    },
  });

  const sendFeedback = useMutation({
    mutationFn: () => apiRequest("POST", "/api/comments", { subject: subject.trim(), message: feedbackMsg.trim() }),
    onSuccess: () => {
      setFeedbackSent(true);
      setSubject("");
      setFeedbackMsg("");
      toast({ title: "Feedback sent", description: "Thank you! The team will review your message." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err?.message || "Could not send feedback", variant: "destructive" });
    },
  });

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!chatInput.trim() || sendMessage.isPending) return;
    sendMessage.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const diff = today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0);
    if (diff === 0) return "Today";
    if (diff === 86400000) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  let lastDate = "";

  return (
    <div className="p-6 max-w-3xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: t.accentFaded(0.12), border: `1px solid ${t.accentFaded(0.3)}` }}
          >
            <MessageSquare className="w-5 h-5" style={{ color: t.accent }} />
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-widest uppercase" style={{ color: t.accent }}>
              Community
            </h1>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
              Connect, share, and raise concerns
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.accentFaded(0.12)}` }}>
        {[
          { id: "chat" as const, label: "Public Chat", icon: Globe },
          { id: "feedback" as const, label: "Private Feedback", icon: Lock },
        ].map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors"
            style={{
              background: activeTab === tab.id ? t.accentFaded(0.08) : "transparent",
              color: activeTab === tab.id ? t.accent : "rgba(107,114,128,1)",
              borderBottom: activeTab === tab.id ? `2px solid ${t.accent}` : "2px solid transparent",
            }}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Public Chat */}
      {activeTab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0">
          {!chatEnabled ? (
            <div
              className="flex-1 flex flex-col items-center justify-center rounded-2xl text-center"
              style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}` }}
            >
              <AlertCircle className="w-8 h-8 mb-3" style={{ color: "rgba(107,114,128,1)" }} />
              <p className="text-sm font-mono text-gray-400 mb-1">Public chat is currently disabled</p>
              <p className="text-[10px] text-gray-600 font-mono">The admin has temporarily turned off the chat.</p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto rounded-2xl p-4 mb-4 space-y-3"
                style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}` }}
              >
                {chatLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ color: t.accentFaded(0.4) }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-6 h-6 mb-2 opacity-20" style={{ color: t.accent }} />
                    <p className="text-xs font-mono text-gray-600">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const msgDate = formatDate(msg.createdAt);
                    const showDate = msgDate !== lastDate;
                    lastDate = msgDate;
                    const isMe = msg.userId === user?.id;

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex-1 h-px" style={{ background: t.accentFaded(0.08) }} />
                            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{msgDate}</span>
                            <div className="flex-1 h-px" style={{ background: t.accentFaded(0.08) }} />
                          </div>
                        )}
                        <div
                          data-testid={`chat-message-${msg.id}`}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[75%] px-3 py-2 rounded-2xl"
                            style={{
                              background: isMe ? t.accentFaded(0.15) : t.accentFaded(0.05),
                              border: `1px solid ${t.accentFaded(isMe ? 0.25 : 0.1)}`,
                            }}
                          >
                            {!isMe && (
                              <p className="text-[9px] font-mono mb-1" style={{ color: t.accentFaded(0.7) }}>
                                {msg.username}
                              </p>
                            )}
                            <p className="text-xs font-mono text-gray-200 break-words">{msg.message}</p>
                            <p className="text-[9px] font-mono text-gray-600 mt-1 text-right">{formatTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  data-testid="input-chat-message"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  maxLength={500}
                  className="flex-1 font-mono text-xs bg-transparent"
                  style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                />
                <Button
                  data-testid="button-send-message"
                  type="submit"
                  disabled={!chatInput.trim() || sendMessage.isPending}
                  className="font-mono text-xs px-4"
                  style={{ background: t.accent, color: "#000" }}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
              <p className="text-[9px] font-mono text-gray-600 mt-1.5 text-right">{chatInput.length}/500</p>
            </>
          )}
        </div>
      )}

      {/* Private Feedback */}
      {activeTab === "feedback" && (
        <div
          className="rounded-2xl p-6"
          style={{ background: t.accentFaded(0.03), border: `1px solid ${t.accentFaded(0.1)}` }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4" style={{ color: t.accent }} />
            <div>
              <p className="text-sm font-mono font-bold text-white">Private Feedback</p>
              <p className="text-[10px] font-mono text-gray-500">Only admins can read your message</p>
            </div>
          </div>

          {feedbackSent ? (
            <div className="text-center py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}
              >
                <MessageSquare className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm font-mono text-green-400 mb-1">Feedback sent!</p>
              <p className="text-xs font-mono text-gray-500 mb-6">The admin team will review your message.</p>
              <Button
                data-testid="button-send-another"
                onClick={() => setFeedbackSent(false)}
                variant="outline"
                className="font-mono text-xs"
                style={{ borderColor: t.accentFaded(0.2), color: t.accentFaded(0.7) }}
              >
                Send Another
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Subject (optional)</label>
                <Input
                  data-testid="input-feedback-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Bug report, feature request, question…"
                  maxLength={200}
                  className="font-mono text-xs bg-transparent"
                  style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">Message *</label>
                <Textarea
                  data-testid="input-feedback-message"
                  value={feedbackMsg}
                  onChange={e => setFeedbackMsg(e.target.value)}
                  placeholder="Describe your concern, bug, or suggestion in detail…"
                  maxLength={2000}
                  rows={6}
                  className="font-mono text-xs bg-transparent resize-none"
                  style={{ borderColor: t.accentFaded(0.2), color: "white" }}
                />
                <p className="text-[9px] font-mono text-gray-600 mt-1 text-right">{feedbackMsg.length}/2000</p>
              </div>

              <Button
                data-testid="button-submit-feedback"
                onClick={() => sendFeedback.mutate()}
                disabled={sendFeedback.isPending || feedbackMsg.trim().length < 5}
                className="w-full font-mono text-xs tracking-widest uppercase"
                style={{ background: t.accent, color: "#000" }}
              >
                {sendFeedback.isPending ? "Sending…" : "Send Private Feedback"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
