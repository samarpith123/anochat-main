import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useGetMessages, useGetOnlineUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { generateSessionId, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, ArrowLeft, Loader2, MessageSquare, Flag, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "/api";

function loadReportedIds(): Set<number> {
  try {
    const stored = localStorage.getItem("reportedMessageIds");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveReportedIds(ids: Set<number>) {
  try {
    localStorage.setItem("reportedMessageIds", JSON.stringify([...ids]));
  } catch {}
}

export default function ChatPage() {
  const { user, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const theirId = params.userId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Report state
  const [reportedIds, setReportedIds] = useState<Set<number>>(loadReportedIds);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);

  // Auto redirect if not logged in or missing param
  useEffect(() => {
    if (isLoaded && (!user || !theirId)) {
      setLocation('/');
    }
  }, [isLoaded, user, theirId, setLocation]);

  const { emitMessage } = useChatSocket();

  // Try to find the user in the online list to show their name/gender
  // We fetch without filter to get everyone
  const { data: usersData } = useGetOnlineUsers({}, { 
    query: { refetchInterval: 10000 } 
  });
  
  const theirInfo = usersData?.users.find(u => u.userId === theirId);
  const theirUsername = theirInfo?.username || "User";

  const sessionId = user && theirId ? generateSessionId(user.userId, theirId) : "";

  // Fetch initial messages REST
  const { data: messagesData, isLoading: isLoadingMessages } = useGetMessages(sessionId, {
    query: { enabled: !!sessionId }
  });

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !user || !theirId || !sessionId) return;

    const content = messageText.trim();
    setMessageText(""); // Optimistic clear

    try {
      const payload = {
        sessionId,
        fromUserId: user.userId,
        toUserId: theirId,
        fromUsername: user.username,
        content
      };

      // Send only via socket — server saves to DB and broadcasts message:new to all clients
      emitMessage(payload);

    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleReport = async (msgId: number) => {
    if (!user || reportedIds.has(msgId) || reportingId === msgId) return;
    setReportingId(msgId);
    try {
      const res = await fetch(`${API_BASE}/messages/${msgId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterUserId: user.userId }),
      });
      if (!res.ok) throw new Error("Report failed");
      const updated = new Set(reportedIds);
      updated.add(msgId);
      setReportedIds(updated);
      saveReportedIds(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setReportingId(null);
      setConfirmingId(null);
    }
  };

  if (!isLoaded || !user || !theirId) return null;

  const messages = messagesData?.messages || [];

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-6rem)] w-full max-w-4xl mx-auto p-0 sm:p-4">
        <div className="flex flex-col h-full glass-panel sm:rounded-3xl overflow-hidden border-x-0 sm:border-x">
          
          {/* Chat Header */}
          <div className="h-16 border-b border-white/5 bg-card/80 flex items-center px-4 shrink-0 z-10 backdrop-blur-md">
            <Link href="/users" className="p-2 mr-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner",
                theirInfo?.gender === 'Male' ? "bg-blue-500/20 text-blue-400" : 
                theirInfo?.gender === 'Female' ? "bg-pink-500/20 text-pink-400" : "bg-secondary text-foreground"
              )}>
                {theirUsername.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-foreground leading-tight">{theirUsername}</h2>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    theirInfo ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted-foreground"
                  )} />
                  <span className="text-xs text-muted-foreground font-medium">
                    {theirInfo ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {isLoadingMessages ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium">No messages yet</p>
                <p className="text-sm">Say hello to start the conversation!</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMine = msg.fromUserId === user.userId;
                  const showHeader = idx === 0 || messages[idx - 1].fromUserId !== msg.fromUserId;
                  const isReported = reportedIds.has(msg.id);
                  const isConfirming = confirmingId === msg.id;
                  const isSubmitting = reportingId === msg.id;
                  
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex flex-col max-w-[75%] group",
                        isMine ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      {showHeader && (
                        <span className="text-xs text-muted-foreground mb-1.5 px-1 font-medium">
                          {isMine ? 'You' : msg.fromUsername}
                        </span>
                      )}
                      
                      <div className="flex items-end gap-2">
                        {/* Report button — only for others' messages, left side */}
                        {!isMine && (
                          <div className="flex flex-col items-center shrink-0 mb-0.5">
                            {isConfirming ? (
                              <div className="flex items-center gap-1 bg-secondary border border-white/10 rounded-xl px-2 py-1 shadow-lg">
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Report?</span>
                                <button
                                  onClick={() => handleReport(msg.id)}
                                  disabled={isSubmitting}
                                  className="text-[11px] font-semibold text-red-400 hover:text-red-300 px-1 transition-colors disabled:opacity-50"
                                >
                                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                                </button>
                                <button
                                  onClick={() => setConfirmingId(null)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground px-1 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => !isReported && setConfirmingId(msg.id)}
                                disabled={isReported}
                                title={isReported ? "You've reported this" : "Report message"}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  isReported
                                    ? "text-green-500 opacity-80"
                                    : "text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-red-400 hover:bg-red-400/10"
                                )}
                              >
                                {isReported
                                  ? <Check className="w-3.5 h-3.5" />
                                  : <Flag className="w-3.5 h-3.5" />
                                }
                              </button>
                            )}
                          </div>
                        )}

                        <div className={cn(
                          "px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed",
                          isMine 
                            ? "bg-primary text-primary-foreground rounded-tr-sm shadow-primary/20" 
                            : "bg-secondary text-secondary-foreground rounded-tl-sm border border-white/5"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                      
                      <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-60">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-card/90 backdrop-blur-lg border-t border-white/5 shrink-0">
            <form 
              onSubmit={handleSend}
              className="flex items-end gap-3 relative"
            >
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Type a message..."
                className="w-full bg-secondary/50 border border-white/10 rounded-2xl px-5 py-3.5 pr-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none min-h-[52px] max-h-[120px]"
                rows={1}
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={!messageText.trim()}
                className="absolute right-2 bottom-2 p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-colors shadow-md shadow-primary/20"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </Layout>
  );
}
