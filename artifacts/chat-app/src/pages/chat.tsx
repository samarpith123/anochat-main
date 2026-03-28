import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useGetMessages, useSendMessage, useGetOnlineUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { generateSessionId, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const { user, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const theirId = params.userId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const sendMutation = useSendMessage();

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

      // 1. Save via REST API
      const savedMessage = await sendMutation.mutateAsync({ data: payload });
      
      // 2. Emit real-time event to ensure partner gets it immediately
      emitMessage(payload);

    } catch (err) {
      console.error("Failed to send message:", err);
      // Could add toast notification here
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
                  
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex flex-col max-w-[75%]",
                        isMine ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      {showHeader && (
                        <span className="text-xs text-muted-foreground mb-1.5 px-1 font-medium">
                          {isMine ? 'You' : msg.fromUsername}
                        </span>
                      )}
                      
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed",
                        isMine 
                          ? "bg-primary text-primary-foreground rounded-tr-sm shadow-primary/20" 
                          : "bg-secondary text-secondary-foreground rounded-tl-sm border border-white/5"
                      )}>
                        {msg.content}
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
                disabled={!messageText.trim() || sendMutation.isPending}
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
