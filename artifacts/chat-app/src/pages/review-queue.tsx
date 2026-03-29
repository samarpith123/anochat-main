import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Shield, ArrowLeft, Trash2, RotateCcw, Loader2, Flag, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";

type ReviewMessage = {
  id: number;
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  fromUsername: string;
  content: string;
  createdAt: string;
  reportCount: number;
};

const API_BASE = "/api";

export default function ReviewQueuePage() {
  const [messages, setMessages] = useState<ReviewMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/review-queue`);
      if (!res.ok) throw new Error(`Failed to load queue: ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleRestore = async (id: number) => {
    setActioning(id);
    try {
      const res = await fetch(`${API_BASE}/review-queue/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  const handleDelete = async (id: number) => {
    setActioning(id);
    try {
      const res = await fetch(`${API_BASE}/review-queue/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActioning(null);
      setConfirmDelete(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Review Queue</h1>
              <p className="text-sm text-muted-foreground">Messages auto-hidden after 3 reports</p>
            </div>
          </div>
          <div className="ml-auto">
            <button
              onClick={fetchQueue}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium text-foreground">Queue is empty</p>
            <p className="text-sm mt-1">No messages are awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              {messages.length} message{messages.length !== 1 ? "s" : ""} awaiting review
            </p>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="glass-panel rounded-2xl p-5 border border-white/5"
              >
                {/* Meta */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{msg.fromUsername}</span>
                    <span className="text-xs text-muted-foreground">→ user</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                      msg.reportCount >= 3
                        ? "bg-red-500/20 text-red-400"
                        : "bg-orange-500/20 text-orange-400"
                    )}>
                      <Flag className="w-3 h-3" />
                      {msg.reportCount} report{msg.reportCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-foreground/80 bg-secondary/50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </p>

                {/* Session ID hint */}
                <p className="text-[10px] text-muted-foreground/40 mt-2 font-mono truncate">
                  session: {msg.sessionId}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4">
                  {confirmDelete === msg.id ? (
                    <>
                      <span className="text-sm text-red-400 mr-auto">Delete permanently?</span>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(msg.id)}
                        disabled={actioning === msg.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors font-medium"
                      >
                        {actioning === msg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Yes, delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRestore(msg.id)}
                        disabled={actioning === msg.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-50 transition-colors"
                      >
                        {actioning === msg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restore
                      </button>
                      <button
                        onClick={() => setConfirmDelete(msg.id)}
                        disabled={actioning === msg.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete forever
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
