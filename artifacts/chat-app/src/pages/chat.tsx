import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useSessionExpiry } from "@/hooks/use-session-expiry";
import { useGetMessages, useGetOnlineUsers, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { generateSessionId, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, ArrowLeft, Loader2, MessageSquare, Flag, Check, Ban, Clock, X, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCountry } from "@/lib/countries";

const API_BASE = "/api";

function loadReportedIds(): Set<number> {
  try {
    const stored = localStorage.getItem("reportedMessageIds");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch { return new Set(); }
}
function saveReportedIds(ids: Set<number>) {
  try { localStorage.setItem("reportedMessageIds", JSON.stringify([...ids])); } catch {}
}
function loadBlockedIds(): Set<string> {
  try {
    const stored = localStorage.getItem("blockedUserIds");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch { return new Set(); }
}
function saveBlockedIds(ids: Set<string>) {
  try { localStorage.setItem("blockedUserIds", JSON.stringify([...ids])); } catch {}
}

export default function ChatPage() {
  const { user, isLoaded, logout } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const params = useParams();
  const theirId = params.userId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { minutesLeft, isExpiring } = useSessionExpiry(logout);
  const [reportedIds, setReportedIds] = useState<Set<number>>(loadReportedIds);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [lastRefId, setLastRefId] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(loadBlockedIds);

  const isBlocked = theirId ? blockedIds.has(theirId) : false;

  const handleToggleBlock = useCallback(() => {
    if (!theirId) return;
    const updated = new Set(blockedIds);
    if (updated.has(theirId)) { updated.delete(theirId); } else { updated.add(theirId); }
    setBlockedIds(updated);
    saveBlockedIds(updated);
  }, [blockedIds, theirId]);

  useEffect(() => {
    if (isLoaded && (!user || !theirId)) setLocation('/');
  }, [isLoaded, user, theirId, setLocation]);

  const { emitMessage } = useChatSocket();

  const [cachedPartner] = useState<{ userId: string; username: string; gender?: string; age?: number; country?: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem("chatPartner");
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.userId === theirId ? p : null;
    } catch { return null; }
  });

  const { data: usersData } = useGetOnlineUsers({}, { query: { refetchInterval: 10000 } });
  const sessionId = user && theirId ? generateSessionId(user.userId, theirId) : "";
  const { data: messagesData, isLoading: isLoadingMessages } = useGetMessages(sessionId, { query: { enabled: !!sessionId } });

  // Cache messages in sessionStorage so they survive a page refresh
  useEffect(() => {
    if (messagesData?.messages?.length && sessionId) {
      try {
        sessionStorage.setItem(`messages_${sessionId}`, JSON.stringify(messagesData.messages));
      } catch {}
    }
  }, [messagesData?.messages, sessionId]);

  // Restore cached messages on mount while API loads
  const cachedMessages = useMemo(() => {
    if (!sessionId) return [];
    try {
      const raw = sessionStorage.getItem(`messages_${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, [sessionId]);
  const theirInfo = usersData?.users.find(u => u.userId === theirId);

  const theirUsername = useMemo(() => {
    if (theirInfo?.username) return theirInfo.username;
    if (cachedPartner?.username) return cachedPartner.username;
    const msgFromThem = messagesData?.messages?.find((m: any) => m.fromUserId === theirId);
    return (msgFromThem as any)?.fromUsername || "User";
  }, [theirInfo, cachedPartner, messagesData, theirId]);

  const theirCountry = theirInfo?.country ?? cachedPartner?.country;
  const theirGender = theirInfo?.gender ?? cachedPartner?.gender;
  const theirAge = theirInfo?.age ?? cachedPartner?.age;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [messagesData?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [messageText]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !user || !theirId || !sessionId || isBlocked) return;
    const content = messageText.trim();
    setMessageText("");
    const payload = { sessionId, fromUserId: user.userId, toUserId: theirId, fromUsername: user.username, content };
    const tempId = emitMessage(payload);
    const queryKey = getGetMessagesQueryKey(sessionId);
    queryClient.setQueryData(queryKey, (oldData: any) => {
      const optimistic = { id: tempId, tempId, sessionId, fromUserId: user.userId, toUserId: theirId, fromUsername: user.username, content, createdAt: new Date() };
      if (!oldData?.messages) return { messages: [optimistic] };
      return { ...oldData, messages: [...oldData.messages, optimistic] };
    });
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
    } catch (err) { console.error(err); }
    finally { setReportingId(null); setConfirmingId(null); }
  };

  if (!isLoaded || !user || !theirId) return null;
  const messages = messagesData?.messages?.length ? messagesData.messages : cachedMessages;

  // Avatar initials helper
  const initials = (name: string) => name.substring(0, 2).toUpperCase();
  const myInitials = initials(user.username);
  const theirInitials = initials(theirUsername);

  return (
    <Layout>
      <div className="flex flex-col flex-1 w-full max-w-4xl mx-auto p-0 sm:p-4 min-h-0 overflow-hidden">
        <div className="flex flex-col h-full sm:rounded-3xl overflow-hidden border border-white/5 bg-card/60 backdrop-blur-xl">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="shrink-0 z-10 bg-card/90 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-3 px-4 py-3">
              <Link href="/users" className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-colors shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Link>

              {/* Avatar */}
              <div className={cn(
                "relative w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2",
                isBlocked ? "bg-muted/20 text-muted-foreground ring-muted/20"
                  : theirGender === 'Male' ? "bg-blue-500/20 text-blue-300 ring-blue-500/30"
                  : theirGender === 'Female' ? "bg-pink-500/20 text-pink-300 ring-pink-500/30"
                  : "bg-primary/20 text-primary ring-primary/30"
              )}>
                {isBlocked ? <Ban className="w-4 h-4" /> : theirInitials}
                {/* Online dot */}
                {!isBlocked && theirInfo && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                )}
              </div>

              {/* Name + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className={cn("font-bold text-base leading-tight truncate", isBlocked ? "text-muted-foreground" : "text-foreground")}>
                    {theirUsername}
                  </h2>
                  {theirGender && !isBlocked && (
                    <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                      theirGender === 'Male' ? "bg-blue-500/15 text-blue-400" : "bg-pink-500/15 text-pink-400"
                    )}>
                      {theirGender}
                    </span>
                  )}
                  {theirAge && !isBlocked && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground shrink-0">
                      {theirAge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isBlocked ? (
                    <span className="text-xs text-red-400/80 font-medium">Blocked</span>
                  ) : (
                    <>
                      <span className={cn("text-xs font-medium", theirInfo ? "text-green-400" : "text-muted-foreground/60")}>
                        {theirInfo ? "Online" : "Offline"}
                      </span>
                      {theirCountry && (
                        <span className="text-xs text-muted-foreground/60">· {formatCountry(theirCountry)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Block button */}
              <button
                onClick={handleToggleBlock}
                title={isBlocked ? "Unblock user" : "Block user"}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0",
                  isBlocked
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                )}
              >
                <Ban className="w-3.5 h-3.5" />
                {isBlocked ? "Unblock" : "Block"}
              </button>
            </div>

            {/* Session expiry banner */}
            <AnimatePresence>
              {isExpiring && minutesLeft !== null && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 bg-amber-500/10 border-t border-amber-500/20 px-4 py-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-400 flex-1">
                      Session expires in <strong>{minutesLeft} min</strong> · IT Rules 2026
                    </span>
                    <button onClick={logout} className="text-xs font-bold text-amber-400 underline hover:text-amber-300 transition-colors">
                      Re-join
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Messages ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(107,95,248,0.03) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(51,153,255,0.03) 0%, transparent 60%)" }}>
            {isBlocked ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-16">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-red-400/60" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">You've blocked {theirUsername}</p>
                  <p className="text-sm text-muted-foreground mt-1">Click <span className="font-semibold text-foreground/70">Unblock</span> above to resume chatting.</p>
                </div>
              </div>
            ) : isLoadingMessages ? (
              <div className="h-full flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-16">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-primary/50" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Start the conversation</p>
                  <p className="text-sm text-muted-foreground mt-1">Say hello to {theirUsername}!</p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg: any, idx: number) => {
                  const isMine = msg.fromUserId === user.userId;
                  const prevMsg = messages[idx - 1] as any;
                  const nextMsg = messages[idx + 1] as any;
                  const isFirstInGroup = !prevMsg || prevMsg.fromUserId !== msg.fromUserId;
                  const isLastInGroup = !nextMsg || nextMsg.fromUserId !== msg.fromUserId;
                  const isReported = reportedIds.has(msg.id);
                  const isConfirming = confirmingId === msg.id;
                  const isSubmitting = reportingId === msg.id;

                  // Timestamp — show if last in group or 5+ min gap
                  const showTime = isLastInGroup || (nextMsg && (new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime()) > 5 * 60 * 1000);

                  return (
                    <motion.div
                      key={msg.id ?? msg.tempId}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className={cn("flex items-end gap-2", isMine ? "flex-row-reverse" : "flex-row", isFirstInGroup ? "mt-4" : "mt-0.5")}
                    >
                      {/* Avatar — only show for first in group, their side */}
                      {!isMine && (
                        <div className={cn("shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          isLastInGroup ? (theirGender === 'Male' ? "bg-blue-500/20 text-blue-300" : theirGender === 'Female' ? "bg-pink-500/20 text-pink-300" : "bg-primary/20 text-primary") : "opacity-0"
                        )}>
                          {theirInitials}
                        </div>
                      )}

                      <div className={cn("flex flex-col max-w-[70%] sm:max-w-[60%]", isMine ? "items-end" : "items-start")}>
                        {/* Sender label — first message in group only */}
                        {isFirstInGroup && !isMine && (
                          <span className="text-[11px] text-muted-foreground font-medium ml-1 mb-1">{msg.fromUsername}</span>
                        )}

                        {/* Bubble + report */}
                        <div className={cn("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}>
                          {/* Report button */}
                          {!isMine && (
                            <div className="shrink-0 mb-1">
                              {isConfirming ? (
                                <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl px-2 py-1 shadow-lg">
                                  <span className="text-[11px] text-muted-foreground">Report?</span>
                                  <button onClick={() => handleReport(msg.id)} disabled={isSubmitting}
                                    className="text-[11px] font-bold text-red-400 hover:text-red-300 px-1 disabled:opacity-50">
                                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                                  </button>
                                  <button onClick={() => setConfirmingId(null)} className="text-[11px] text-muted-foreground hover:text-foreground px-1">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => !isReported && setConfirmingId(msg.id)}
                                  disabled={isReported}
                                  title={isReported ? "Reported" : "Report message"}
                                  className={cn("p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                                    isReported ? "opacity-100 text-green-500" : "text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/10"
                                  )}
                                >
                                  {isReported ? <Check className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Message bubble */}
                          <div className={cn(
                            "px-4 py-2.5 text-sm leading-relaxed break-words",
                            isMine
                              ? "bg-primary text-white shadow-lg shadow-primary/20"
                              : "bg-white/8 text-foreground border border-white/8",
                            // Bubble shape — rounded corners except joining side
                            isMine
                              ? isFirstInGroup && isLastInGroup ? "rounded-2xl rounded-tr-md"
                                : isFirstInGroup ? "rounded-2xl rounded-tr-md rounded-br-md"
                                : isLastInGroup ? "rounded-2xl rounded-tr-md rounded-tr-2xl"
                                : "rounded-2xl rounded-r-md"
                              : isFirstInGroup && isLastInGroup ? "rounded-2xl rounded-tl-md"
                                : isFirstInGroup ? "rounded-2xl rounded-tl-md rounded-bl-md"
                                : isLastInGroup ? "rounded-2xl rounded-tl-md"
                                : "rounded-2xl rounded-l-md",
                            msg.tempId && !msg.id ? "opacity-80" : ""
                          )}>
                            {msg.content}
                          </div>
                        </div>

                        {/* Timestamp */}
                        {showTime && (
                          <span className={cn("text-[10px] text-muted-foreground/50 mt-1", isMine ? "mr-1" : "ml-1")}>
                            {format(new Date(msg.createdAt), 'h:mm a')}
                          </span>
                        )}
                      </div>

                      {/* My avatar placeholder for alignment */}
                      {isMine && <div className="w-8 shrink-0" />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Report ack banner */}
          <AnimatePresence>
            {lastRefId && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden shrink-0">
                <div className="flex items-start gap-3 bg-green-500/10 border-t border-green-500/20 px-4 py-3">
                  <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-400">Report received</p>
                    <p className="font-mono text-xs text-green-300 mt-0.5 font-bold">{lastRefId}</p>
                  </div>
                  <button onClick={() => setLastRefId(null)} className="text-green-400/50 hover:text-green-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input Area ─────────────────────────────────────────────── */}
          <div className={cn("shrink-0 px-4 py-3 bg-card/90 backdrop-blur-md border-t border-white/5", isBlocked && "opacity-50 pointer-events-none")}>
            <form onSubmit={handleSend} className="flex items-end gap-2">
              {/* My avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mb-1",
                user.gender === 'Male' ? "bg-blue-500/20 text-blue-300" : "bg-pink-500/20 text-pink-300"
              )}>
                {myInitials}
              </div>

              {/* Textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                  }}
                  placeholder={isBlocked ? "You have blocked this user" : `Message ${theirUsername}...`}
                  disabled={isBlocked}
                  rows={1}
                  maxLength={1000}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all resize-none disabled:cursor-not-allowed leading-relaxed"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || isBlocked}
                  className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary transition-all shadow-md shadow-primary/30"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </form>
            <p className="text-[10px] text-muted-foreground/30 text-center mt-2">Enter to send · Shift+Enter for new line</p>
          </div>

        </div>
      </div>
    </Layout>
  );
}
