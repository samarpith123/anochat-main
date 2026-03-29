import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useSessionExpiry } from "@/hooks/use-session-expiry";
import { useGetMessages, useGetOnlineUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { generateSessionId, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, ArrowLeft, Loader2, MessageSquare, Flag, Check, Ban, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCountry } from "@/lib/countries";

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

function loadBlockedIds(): Set<string> {
  try {
    const stored = localStorage.getItem("blockedUserIds");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveBlockedIds(ids: Set<string>) {
  try {
    localStorage.setItem("blockedUserIds", JSON.stringify([...ids]));
  } catch {}
}

export default function ChatPage() {
  const { user, isLoaded, logout } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const theirId = params.userId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 6-hour session expiry (IT Rules 2026 — Telecom Cyber Security)
  const { minutesLeft, isExpiring } = useSessionExpiry(logout);

  // Report state
  const [reportedIds, setReportedIds] = useState<Set<number>>(loadReportedIds);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [lastRefId, setLastRefId] = useState<string | null>(null);

  // Block state
  const [blockedIds, setBlockedIds] = useState<Set<string>>(loadBlockedIds);

  const isBlocked = theirId ? blockedIds.has(theirId) : false;

  const handleToggleBlock = useCallback(() => {
    if (!theirId) return;
    const updated = new Set(blockedIds);
    if (updated.has(theirId)) {
      updated.delete(theirId);
    } else {
      updated.add(theirId);
    }
    setBlockedIds(updated);
    saveBlockedIds(updated);
  }, [blockedIds, theirId]);

  // Auto redirect if not logged in or missing param
  useEffect(() => {
    if (isLoaded && (!user || !theirId)) {
      setLocation('/');
    }
  }, [isLoaded, user, theirId, setLocation]);

  const { emitMessage } = useChatSocket();

  // Read cached partner info once on mount (stored when user clicked their card)
  const [cachedPartner] = useState<{ userId: string; username: string; gender?: string; country?: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem("chatPartner");
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.userId === theirId ? p : null;
    } catch { return null; }
  });

  const { data: usersData } = useGetOnlineUsers({}, { 
    query: { refetchInterval: 10000 } 
  });

  const sessionId = user && theirId ? generateSessionId(user.userId, theirId) : "";

  const { data: messagesData, isLoading: isLoadingMessages } = useGetMessages(sessionId, {
    query: { enabled: !!sessionId }
  });

  const theirInfo = usersData?.users.find(u => u.userId === theirId);

  // Derive username: live online list → sessionStorage cache → message history → fallback
  const theirUsername = useMemo(() => {
    if (theirInfo?.username) return theirInfo.username;
    if (cachedPartner?.username) return cachedPartner.username;
    const msgFromThem = messagesData?.messages?.find((m: any) => m.fromUserId === theirId);
    return (msgFromThem as any)?.fromUsername || "User";
  }, [theirInfo, cachedPartner, messagesData, theirId]);

  const theirCountry = theirInfo?.country ?? cachedPartner?.country;
  const theirGender = theirInfo?.gender ?? cachedPartner?.gender;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !user || !theirId || !sessionId || isBlocked) return;

    const content = messageText.trim();
    setMessageText("");

    try {
      const payload = {
        sessionId,
        fromUserId: user.userId,
        toUserId: theirId,
        fromUsername: user.username,
        content
      };
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
      const data = await res.json();
      const updated = new Set(reportedIds);
      updated.add(msgId);
      setReportedIds(updated);
      saveReportedIds(updated);
      if (data.referenceId) setLastRefId(data.referenceId);
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
            
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0",
                isBlocked
                  ? "bg-muted/20 text-muted-foreground"
                  : theirGender === 'Male' ? "bg-blue-500/20 text-blue-400" 
                  : theirGender === 'Female' ? "bg-pink-500/20 text-pink-400" 
                  : "bg-secondary text-foreground"
              )}>
                {isBlocked ? <Ban className="w-4 h-4" /> : theirUsername.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className={cn("font-bold leading-tight truncate", isBlocked ? "text-muted-foreground" : "text-foreground")}>
                  {theirUsername}
                </h2>
                <div className="flex items-center gap-1.5">
                  {isBlocked ? (
                    <span className="text-xs text-red-400/80 font-medium">Blocked</span>
                  ) : (
                    <>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        theirInfo ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted-foreground"
                      )} />
                      <span className="text-xs text-muted-foreground font-medium truncate">
                        {theirInfo ? 'Online' : 'Offline'}
                        {theirCountry && ` · ${formatCountry(theirCountry)}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Block / Unblock button */}
            <button
              onClick={handleToggleBlock}
              title={isBlocked ? "Unblock user" : "Block user"}
              className={cn(
                "ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                isBlocked
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
              )}
            >
              <Ban className="w-3.5 h-3.5" />
              {isBlocked ? "Unblock" : "Block"}
            </button>
          </div>

          {/* Session Expiry Warning Banner (IT Rules 2026 — 6-Hour Rule) */}
          <AnimatePresence>
            {isExpiring && minutesLeft !== null && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-yellow-400">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium flex-1">
                    Session expires in <strong>{minutesLeft} min</strong> (IT Rules 2026 — 6-hour limit)
                  </span>
                  <button onClick={logout} className="text-xs font-semibold underline hover:text-yellow-300 transition-colors">
                    Re-join now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {isBlocked ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <Ban className="w-8 h-8 text-red-400/60" />
                </div>
                <p className="font-medium text-foreground">You've blocked {theirUsername}</p>
                <p className="text-sm mt-1 text-center max-w-xs">
                  You won't receive or send messages. Click <span className="font-semibold text-foreground/70">Unblock</span> above to resume.
                </p>
              </div>
            ) : isLoadingMessages ? (
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
                        {/* Report button — only for others' messages */}
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

          {/* Report Acknowledgment (IT Rules 2026 — 24hr reference receipt) */}
          <AnimatePresence>
            {lastRefId && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 bg-green-500/10 border-t border-green-500/20 px-4 py-3">
                  <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-400">Report received — save your reference ID</p>
                    <p className="text-[11px] text-green-400/70 mt-0.5">
                      Our Grievance Officer will review within 36 hours (2 hours for urgent content).
                    </p>
                    <p className="font-mono text-xs text-green-300 mt-1 font-bold tracking-wide">{lastRefId}</p>
                  </div>
                  <button onClick={() => setLastRefId(null)} className="text-green-400/50 hover:text-green-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className={cn(
            "p-4 bg-card/90 backdrop-blur-lg border-t border-white/5 shrink-0",
            isBlocked && "opacity-50 pointer-events-none"
          )}>
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
                placeholder={isBlocked ? "You have blocked this user" : "Type a message..."}
                disabled={isBlocked}
                className="w-full bg-secondary/50 border border-white/10 rounded-2xl px-5 py-3.5 pr-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none min-h-[52px] max-h-[120px] disabled:cursor-not-allowed"
                rows={1}
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isBlocked}
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
