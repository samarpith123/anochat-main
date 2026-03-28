import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useJoinChat } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquare, ArrowRight, UserCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user, login, isLoaded } = useAuth();
  
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [errorMsg, setErrorMsg] = useState("");

  const joinMutation = useJoinChat();

  useEffect(() => {
    if (isLoaded && user) {
      setLocation('/users');
    }
  }, [isLoaded, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (username.trim().length < 2 || username.length > 20) {
      setErrorMsg("Username must be between 2 and 20 characters.");
      return;
    }

    try {
      const response = await joinMutation.mutateAsync({
        data: { username: username.trim(), gender }
      });
      
      login({
        userId: response.userId,
        username: response.username,
        gender: response.gender as 'Male' | 'Female'
      });
      
      setLocation('/users');
    } catch (err: any) {
      setErrorMsg(err.message || "Username is already taken or invalid.");
    }
  };

  if (!isLoaded || user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Hero background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="glass-panel p-8 sm:p-10 rounded-3xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Join the Chat
            </h1>
            <p className="text-muted-foreground">
              Connect instantly. No registration required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">Choose a Username</label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ShadowHunter99"
                  maxLength={20}
                  className="w-full pl-12 pr-4 py-3.5 bg-secondary/50 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  disabled={joinMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">I identify as</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setGender('Male')}
                  className={cn(
                    "py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all duration-200",
                    gender === 'Male' 
                      ? "bg-blue-500/10 border-blue-500 text-blue-400" 
                      : "bg-secondary/50 border-white/10 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", gender === 'Male' ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-transparent")} />
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender('Female')}
                  className={cn(
                    "py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all duration-200",
                    gender === 'Female' 
                      ? "bg-pink-500/10 border-pink-500 text-pink-400" 
                      : "bg-secondary/50 border-white/10 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", gender === 'Female' ? "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]" : "bg-transparent")} />
                  Female
                </button>
              </div>
            </div>

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={joinMutation.isPending || !username.trim()}
              className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2"
            >
              {joinMutation.isPending ? "Connecting..." : "Enter Chat"}
              {!joinMutation.isPending && <ArrowRight className="w-5 h-5" />}
            </button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
              By using this site, you agree to follow the <span className="text-foreground/70 font-medium">IT Rules 2026</span>. Sharing illegal synthetic content (deepfakes) or harassment will result in a permanent ban and may be reported to <span className="text-foreground/70 font-medium">I4C authorities</span>.
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
