import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Lock, Globe, AlertCircle, Loader2, CheckCircle } from "lucide-react";

type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  message: string;
  createdAt: string;
};

export default function Community() {
  const { user } = useAuth();
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

  const { data: chatData, isLoading: chatLoading, isError: chatError, refetch: refetchChat } = useQuery<{ messages: ChatMessage[]; enabled: boolean }>({
    queryKey: ["/api/chat/messages"],
    enabled: !!user,
    refetchInterval: 4000,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
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

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const diff = new Date(today.setHours(0, 0, 0, 0)).getTime() - new Date(d.setHours(0, 0, 0, 0)).getTime();
    if (diff === 0) return "Today";
    if (diff === 86400000) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  let lastDate = "";

  const inputStyle = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(74,222,128,0.2)",
    color: "white",
  };

  return (
    <div className="p-4 sm:p-6 min-h-full flex flex-col" data-testid="community-page">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold mb-1 text-white">Community</h1>
          <p className="text-gray-400 font-mono text-xs sm:text-sm">Connect, share ideas, and reach out to the team</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex mb-6 rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
      >
        {[
          { id: "chat" as const, label: "Public Chat", icon: Globe },
          { id: "feedback" as const, label: "Private Feedback", icon: Lock },
        ].map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-mono uppercase tracking-widest transition-all"
            style={{
              background: activeTab === tab.id ? "rgba(74,222,128,0.08)" : "transparent",
              color: activeTab === tab.id ? "hsl(142 76% 42%)" : "#6b7280",
              borderBottom: activeTab === tab.id ? "2px solid hsl(142 76% 42%)" : "2px solid transparent",
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
              className="flex-1 flex flex-col items-center justify-center rounded-xl text-center py-16"
              style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
            >
              <AlertCircle className="w-9 h-9 mb-3" style={{ color: "rgba(107,114,128,1)" }} />
              <p className="text-sm font-mono text-gray-400 mb-1">Public chat is currently disabled</p>
              <p className="text-[10px] text-gray-600 font-mono">The admin has temporarily turned off the chat.</p>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto rounded-xl p-4 mb-3 space-y-3"
                style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", minHeight: 280, maxHeight: 460 }}
              >
                {chatLoading ? (
                  <div className="flex items-center justify-center h-full py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary opacity-50" />
                  </div>
                ) : chatError ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                    <AlertCircle className="w-7 h-7 text-red-400 opacity-60" />
                    <p className="text-xs font-mono text-gray-500">Could not load messages</p>
                    <button onClick={() => refetchChat()} className="text-[10px] font-mono text-primary underline">Retry</button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10">
                    <MessageSquare className="w-7 h-7 mb-2 opacity-20 text-primary" />
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
                            <div className="flex-1 h-px" style={{ background: "rgba(74,222,128,0.08)" }} />
                            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{msgDate}</span>
                            <div className="flex-1 h-px" style={{ background: "rgba(74,222,128,0.08)" }} />
                          </div>
                        )}
                        <div
                          data-testid={`chat-message-${msg.id}`}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[75%] px-3 py-2 rounded-2xl"
                            style={{
                              background: isMe ? "rgba(74,222,128,0.12)" : "rgba(74,222,128,0.04)",
                              border: `1px solid ${isMe ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.08)"}`,
                            }}
                          >
                            {!isMe && (
                              <p className="text-[9px] font-mono mb-1 text-primary opacity-70">{msg.username}</p>
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
                <input
                  data-testid="input-chat-message"
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message… (Enter to send)"
                  maxLength={500}
                  className="flex-1 px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
                <button
                  data-testid="button-send-message"
                  type="submit"
                  disabled={!chatInput.trim() || sendMessage.isPending}
                  className="flex items-center justify-center px-4 py-2.5 rounded-lg transition-all"
                  style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "hsl(142 76% 42%)" }}
                >
                  {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
              <p className="text-[9px] font-mono text-gray-700 mt-1 text-right">{chatInput.length}/500</p>
            </>
          )}
        </div>
      )}

      {/* Private Feedback */}
      {activeTab === "feedback" && (
        <div
          className="rounded-xl p-5 sm:p-6"
          style={{ border: "1px solid rgba(74,222,128,0.15)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{ background: "rgba(74,222,128,0.1)" }}>
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Private Feedback</p>
              <p className="text-[10px] font-mono text-gray-500 mt-0.5">Only admins can read your message — your identity is visible to them</p>
            </div>
          </div>

          {feedbackSent ? (
            <div className="text-center py-10">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}
              >
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-mono text-white mb-1">Feedback sent!</p>
              <p className="text-xs font-mono text-gray-500 mb-6">The admin team will review your message shortly.</p>
              <button
                data-testid="button-send-another"
                onClick={() => setFeedbackSent(false)}
                className="px-5 py-2.5 rounded-lg font-mono text-xs font-bold transition-all hover:opacity-90"
                style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "hsl(142 76% 42%)" }}
              >
                Send Another
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">Subject (optional)</label>
                <input
                  data-testid="input-feedback-subject"
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Bug report, feature request, question…"
                  maxLength={200}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">Message *</label>
                <textarea
                  data-testid="input-feedback-message"
                  value={feedbackMsg}
                  onChange={e => setFeedbackMsg(e.target.value)}
                  placeholder="Describe your concern, bug, or suggestion in detail…"
                  maxLength={2000}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs outline-none resize-none"
                  style={inputStyle}
                />
                <p className="text-[9px] font-mono text-gray-600 mt-1 text-right">{feedbackMsg.length}/2000</p>
              </div>

              <button
                data-testid="button-submit-feedback"
                onClick={() => sendFeedback.mutate()}
                disabled={sendFeedback.isPending || feedbackMsg.trim().length < 5}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
                style={{
                  background: feedbackMsg.trim().length >= 5 ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.05)",
                  border: `1px solid ${feedbackMsg.trim().length >= 5 ? "rgba(74,222,128,0.4)" : "rgba(74,222,128,0.1)"}`,
                  color: feedbackMsg.trim().length >= 5 ? "hsl(142 76% 42%)" : "#6b7280",
                }}
              >
                {sendFeedback.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sendFeedback.isPending ? "Sending…" : "Send Private Feedback"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
