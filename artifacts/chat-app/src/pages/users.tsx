import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetOnlineUsers, GetOnlineUsersGender } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { Layout } from "@/components/Layout";
import { Users, Search, MessageCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCountry } from "@/lib/countries";

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

export default function UsersPage() {
  const { user, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<GetOnlineUsersGender>('all');
  const [blockedIds, setBlockedIds] = useState<Set<string>>(loadBlockedIds);

  // Initialize socket connection to receive presence updates in the background
  useChatSocket();

  useEffect(() => {
    if (isLoaded && !user) {
      setLocation('/');
    }
  }, [isLoaded, user, setLocation]);

  const { data, isLoading } = useGetOnlineUsers(
    { gender: filter },
    { query: { refetchInterval: 3000 } }
  );

  const handleBlock = useCallback((e: React.MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = new Set(blockedIds);
    if (updated.has(userId)) {
      updated.delete(userId);
    } else {
      updated.add(userId);
    }
    setBlockedIds(updated);
    saveBlockedIds(updated);
  }, [blockedIds]);

  if (!isLoaded || !user) return null;

  // Filter out current user and blocked users
  const otherUsers = data?.users.filter(
    (u) => u.userId !== user.userId && !blockedIds.has(u.userId)
  ) || [];

  const blockedCount = data?.users.filter(
    (u) => u.userId !== user.userId && blockedIds.has(u.userId)
  ).length ?? 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto mt-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Online Now
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              {otherUsers.length} {otherUsers.length === 1 ? "person is" : "people are"} ready to chat
              {blockedCount > 0 && (
                <span className="text-sm text-muted-foreground/60 ml-2">
                  ({blockedCount} blocked)
                </span>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="glass-panel p-1.5 rounded-2xl inline-flex w-full md:w-auto overflow-hidden">
            {(['all', 'Male', 'Female'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={cn(
                  "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                  filter === g 
                    ? "bg-secondary text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {g === 'all' ? 'Everyone' : g}
              </button>
            ))}
          </div>
        </div>

        {/* User Grid */}
        {isLoading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-24 glass-panel rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : otherUsers.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-3xl border-dashed">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No one is online</h3>
            <p className="text-muted-foreground">It's quiet here. Wait for someone to join.</p>
          </div>
        ) : (
          <motion.div 
            layout 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {otherUsers.map((u) => {
                const isBlocked = blockedIds.has(u.userId);
                const countryLabel = u.country ? formatCountry(u.country) : null;

                return (
                  <motion.div
                    key={u.userId}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="relative group"
                  >
                    {/* Block button — top right, appears on hover */}
                    <button
                      onClick={(e) => handleBlock(e, u.userId)}
                      title={isBlocked ? "Unblock user" : "Block user"}
                      className={cn(
                        "absolute top-2 right-2 z-20 p-1.5 rounded-lg transition-all duration-200",
                        isBlocked
                          ? "text-red-400 bg-red-500/10 opacity-100"
                          : "text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`/chat/${u.userId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setLocation(`/chat/${u.userId}`);
                      }}
                      className="group/card block glass-panel p-5 rounded-2xl hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0",
                          u.gender === 'Male' ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
                        )}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground truncate group-hover/card:text-primary transition-colors">
                            {u.username}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                              u.gender === 'Male' ? "bg-blue-500" : "bg-pink-500"
                            )} />
                            {u.gender}
                          </p>
                          {countryLabel && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                              {countryLabel}
                            </p>
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover/card:bg-primary group-hover/card:text-white transition-colors shrink-0">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                      </div>
                    </a>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
