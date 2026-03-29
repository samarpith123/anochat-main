import { useState, useEffect, useCallback, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Shield, Lock, Eye, EyeOff, RefreshCw, Loader2, AlertTriangle,
  Trash2, Ban, RotateCcw, LogOut, Flag, CheckCircle, EyeOff as HideIcon,
  Clock, User, Wifi, Clock as ClockIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api/admin";
const TOKEN_KEY = "adminSessionToken";

type ReportedMessage = {
  id: number;
  sessionId: string;
  fromUserId: string;
  fromUsername: string;
  content: string;
  createdAt: string;
  reportCount: number;
  isHidden: boolean;
  ipAddress?: string;
};

type Ban = {
  id: number;
  banned_value: string;
  ban_type: "user" | "ip";
  banned_until: string;
  reason: string;
  created_at: string;
};

function useAdminFetch(token: string) {
  return useCallback(
    (path: string, options: RequestInit = {}) =>
      fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
          ...(options.headers ?? {}),
        },
      }),
    [token]
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm glass-panel p-8 rounded-3xl">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-orange-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-foreground mb-1">Admin Access</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">Anochat Control Panel</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full pl-11 pr-11 py-3.5 bg-secondary/50 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? "Verifying..." : "Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Reported Message Card ─────────────────────────────────────────────────────
function MessageCard({
  msg,
  apiFetch,
  onAction,
}: {
  msg: ReportedMessage;
  apiFetch: ReturnType<typeof useAdminFetch>;
  onAction: () => void;
}) {
  const [actioning, setActioning] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);
  const [banResult, setBanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doAction = async (action: () => Promise<Response>, label: string) => {
    setActioning(label);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      onAction();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  const handleBan = async () => {
    setActioning("ban");
    setError(null);
    setBanResult(null);
    try {
      const res = await apiFetch("/ban", {
        method: "POST",
        body: JSON.stringify({
          userId: msg.fromUserId,
          ip: msg.ipAddress,
          messageId: msg.id,
          hours: 24,
          reason: `IT Rules 2026 violation — reported ${msg.reportCount}x. Message: "${msg.content.slice(0, 80)}"`,
          deleteMsg: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ban failed");
      setBanResult(`Banned ${data.count} value${data.count !== 1 ? "s" : ""} (user + IP). Message deleted.`);
      onAction();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActioning(null);
      setConfirmBan(false);
    }
  };

  const isActioning = (label: string) => actioning === label;

  // SLA urgency clock (IT Rules 2026 takedown windows)
  const hoursElapsed = (Date.now() - new Date(msg.createdAt).getTime()) / (1000 * 60 * 60);
  const slaBreach = hoursElapsed >= 36;
  const slaWarning = hoursElapsed >= 2 && hoursElapsed < 36;
  const slaOk = hoursElapsed < 2;

  const slaLabel = slaOk
    ? `${Math.round(hoursElapsed * 60)}m old — within 2h SLA`
    : slaBreach
    ? `${Math.floor(hoursElapsed)}h old — 36h SLA BREACHED`
    : `${Math.floor(hoursElapsed)}h old — within 36h SLA`;

  return (
    <div className={cn(
      "glass-panel rounded-2xl p-5 border transition-all",
      msg.isHidden ? "border-red-500/20 bg-red-500/5" : "border-orange-500/20 bg-orange-500/5"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{msg.fromUsername}</span>
          <span className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
            msg.reportCount >= 3 ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"
          )}>
            <Flag className="w-3 h-3" />
            {msg.reportCount} report{msg.reportCount !== 1 ? "s" : ""}
          </span>
          {msg.isHidden && (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              <HideIcon className="w-3 h-3" />
              Hidden
            </span>
          )}
          {/* SLA Urgency Clock */}
          <span className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
            slaOk ? "bg-green-500/10 text-green-400"
              : slaWarning ? "bg-yellow-500/10 text-yellow-400"
              : "bg-red-600/20 text-red-300 animate-pulse"
          )}>
            <Clock className="w-3 h-3" />
            {slaLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(msg.createdAt), "MMM d, h:mm a")}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground/80 bg-secondary/50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap break-words mb-3">
        {msg.content}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 font-mono mb-4 flex-wrap">
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{msg.fromUserId.slice(0, 12)}…</span>
        {msg.ipAddress && (
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{msg.ipAddress}</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Ban result */}
      {banResult && (
        <div className="mb-3 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle className="w-3 h-3 shrink-0" />
          {banResult}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {confirmBan ? (
          <>
            <span className="text-sm text-red-400 font-medium">Ban user + IP for 24h?</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setConfirmBan(false)} className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={!!actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors font-semibold"
              >
                {isActioning("ban") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Ban
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Hide / Restore */}
            {msg.isHidden ? (
              <button
                onClick={() => doAction(() => apiFetch(`/messages/${msg.id}/restore`, { method: "POST" }), "restore")}
                disabled={!!actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-50 transition-colors"
              >
                {isActioning("restore") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Restore
              </button>
            ) : (
              <button
                onClick={() => doAction(() => apiFetch(`/messages/${msg.id}/hide`, { method: "POST" }), "hide")}
                disabled={!!actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-50 transition-colors"
              >
                {isActioning("hide") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HideIcon className="w-3.5 h-3.5" />}
                Hide
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => doAction(() => apiFetch(`/messages/${msg.id}`, { method: "DELETE" }), "delete")}
              disabled={!!actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              {isActioning("delete") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>

            {/* Global Ban */}
            <button
              onClick={() => setConfirmBan(true)}
              disabled={!!actioning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 disabled:opacity-50 transition-colors font-semibold ml-auto"
            >
              <Ban className="w-3.5 h-3.5" />
              Global Ban 24h
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const apiFetch = useAdminFetch(token);
  const [tab, setTab] = useState<"reports" | "bans">("reports");
  const [messages, setMessages] = useState<ReportedMessage[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, bRes] = await Promise.all([
        apiFetch("/reported"),
        apiFetch("/bans"),
      ]);
      if (rRes.status === 401 || bRes.status === 401) { onLogout(); return; }
      if (!rRes.ok) throw new Error("Failed to load reports");
      if (!bRes.ok) throw new Error("Failed to load bans");
      const rData = await rRes.json();
      const bData = await bRes.json();
      setMessages(rData.messages || []);
      setBans(bData.bans || []);
      setLastRefresh(new Date());
      setCountdown(30);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onLogout]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { fetchReports(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchReports]);

  const handleUnban = async (banId: number) => {
    try {
      const res = await apiFetch(`/bans/${banId}`, { method: "DELETE" });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error("Unban failed");
      setBans((prev) => prev.filter((b) => b.id !== banId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const hiddenCount = messages.filter((m) => m.isHidden).length;
  const flaggedCount = messages.filter((m) => !m.isHidden).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 border-b border-white/5 bg-card/90 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-orange-400" />
            <span className="font-bold text-foreground">Anochat Admin</span>
          </div>

          <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Refresh in {countdown}s</span>
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Flagged", value: flaggedCount, color: "text-orange-400", bg: "bg-orange-500/10" },
            { label: "Auto-Hidden", value: hiddenCount, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Total Reports", value: messages.reduce((s, m) => s + m.reportCount, 0), color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Active Bans", value: bans.length, color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map((s) => (
            <div key={s.label} className={cn("glass-panel rounded-2xl p-4 border border-white/5", s.bg)}>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 glass-panel p-1.5 rounded-2xl w-fit mb-6">
          {(["reports", "bans"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-medium transition-all",
                tab === t ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "reports" ? `Reports (${messages.length})` : `Active Bans (${bans.length})`}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Reports Tab */}
        {tab === "reports" && (
          <div>
            {loading && messages.length === 0 ? (
              <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20 glass-panel rounded-3xl">
                <CheckCircle className="w-12 h-12 text-green-500/50 mx-auto mb-4" />
                <p className="font-bold text-foreground">All clear</p>
                <p className="text-sm text-muted-foreground mt-1">No reported messages.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                </p>
                {messages.map((msg) => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    apiFetch={apiFetch}
                    onAction={fetchReports}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bans Tab */}
        {tab === "bans" && (
          <div>
            {bans.length === 0 ? (
              <div className="text-center py-20 glass-panel rounded-3xl">
                <Ban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-bold text-foreground">No active bans</p>
                <p className="text-sm text-muted-foreground mt-1">Bans issued will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bans.map((ban) => (
                  <div key={ban.id} className="glass-panel rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      ban.ban_type === "ip" ? "bg-purple-500/20" : "bg-red-500/20"
                    )}>
                      {ban.ban_type === "ip"
                        ? <Wifi className="w-4 h-4 text-purple-400" />
                        : <User className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-foreground font-medium truncate">{ban.banned_value}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          ban.ban_type === "ip" ? "bg-purple-500/20 text-purple-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {ban.ban_type === "ip" ? "IP ban" : "User ban"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ban.reason}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Expires {formatDistanceToNow(new Date(ban.banned_until), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnban(ban.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Lift ban
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function AdminControlPage() {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY)
  );

  const handleLogin = (t: string) => setToken(t);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  if (!token) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
