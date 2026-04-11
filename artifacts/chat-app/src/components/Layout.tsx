import { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, MessageSquare, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, isLoaded } = useAuth();

  if (!isLoaded) return null;

  return (
    <div className="h-screen flex flex-col relative bg-background overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation Bar */}
      {user && (
        <header className="sticky top-0 z-50 glass-panel border-b-0 border-white/5 border-t-0 border-x-0 rounded-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/users" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-foreground">
                AnoChat
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-secondary/50 px-4 py-2 rounded-full border border-white/5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  user.gender === 'Male' ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]"
                )} />
                <span className="text-sm font-medium text-foreground">{user.username}</span>
              </div>
              
              <button
                onClick={logout}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors group"
                title="Leave Chat"
              >
                <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 w-full max-w-7xl mx-auto overflow-hidden">
        {children}
      </main>
    </div>
  );
}
