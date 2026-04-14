import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useJoinChat } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { COUNTRIES, type Country } from "@/lib/countries";
import {
  MessageSquare, ArrowRight, UserCircle, AlertCircle, ChevronDown, Search,
  Shield, X, Mail, User, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADVISORY_KEY = "itAdvisoryAck";
const ADVISORY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function CountryDropdown({
  value,
  onChange,
  disabled,
}: {
  value: Country;
  onChange: (c: Country) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-secondary/50 border border-white/10 rounded-xl text-foreground hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
      >
        <span className="text-xl leading-none">{value.flag}</span>
        <span className="flex-1 text-left font-medium">{value.name}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
          >
            <div className="p-2 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full pl-9 pr-3 py-2 bg-secondary/50 border border-white/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No results</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/70 transition-colors text-left",
                      c.code === value.code && "bg-primary/10 text-primary"
                    )}
                  >
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span className="font-medium">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compliance Advisory Modal (IT Rules 2026) ─────────────────────────────────
function AdvisoryModal({ onAccept }: { onAccept: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4 border-b border-white/5">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg leading-tight">Platform Rules — IT Rules 2026</h2>
            <p className="text-xs text-muted-foreground">Read before entering the chat</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            <RuleItem icon="🚫" title="Prohibited content">
              Hate speech, incitement to violence, non-consensual intimate imagery, AI deepfakes, impersonation, or any content illegal under the Bharatiya Nyaya Sanhita (BNS).
            </RuleItem>
            <RuleItem icon="📋" title="Data logging">
              Your session IP address is logged. If content is removed following a report, your IP, message content, and timestamps are preserved for <strong className="text-foreground">180 days</strong> for law enforcement under IT Rules 2026.
            </RuleItem>
            <RuleItem icon="⚖️" title="Enforcement">
              Violations result in an immediate ban. Details may be shared with I4C or law enforcement authorities under the BNS.
            </RuleItem>
            <RuleItem icon="⏱️" title="Session limit">
              All sessions <strong className="text-foreground">automatically expire after 6 hours</strong> (Telecom Cyber Security Rules, March 2026). You will be warned before expiry and prompted to re-join.
            </RuleItem>
            <RuleItem icon="🏳️" title="Reports">
              Flagged content is reviewed by our Grievance Officer within <strong className="text-foreground">36 hours</strong> (2 hours for deepfakes/non-consensual imagery). You will receive a reference ID on every report.
            </RuleItem>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/5">
          <button
            onClick={onAccept}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg shadow-primary/25"
          >
            I Understand — Enter Chat
          </button>
          <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
            You will see this reminder every 90 days as required by IT Rules 2026.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RuleItem({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-secondary/30 rounded-xl p-3.5">
      <span className="text-xl leading-none mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}


// ── FAQ Accordion Item ────────────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 hover:bg-secondary/30 transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{question}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user, login, isLoaded } = useAuth();

  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [age, setAge] = useState<number>(18);
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvisory, setShowAdvisory] = useState(false);

  const joinMutation = useJoinChat();

  useEffect(() => {
    if (isLoaded && user) {
      setLocation('/users');
    }
  }, [isLoaded, user, setLocation]);

  // Check advisory acknowledgment (show every 90 days — IT Rules 2026 quarterly requirement)
  useEffect(() => {
    const raw = localStorage.getItem(ADVISORY_KEY);
    if (!raw) { setShowAdvisory(true); return; }
    const ts = parseInt(raw, 10);
    if (Date.now() - ts > ADVISORY_TTL_MS) setShowAdvisory(true);
  }, []);

  const handleAdvisoryAccept = () => {
    localStorage.setItem(ADVISORY_KEY, String(Date.now()));
    setShowAdvisory(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (username.trim().length < 2 || username.length > 20) {
      setErrorMsg("Username must be between 2 and 20 characters.");
      return;
    }

    if (age < 18 || age > 99) {
      setErrorMsg("You must be between 18 and 99 years old.");
      return;
    }

    try {
      const response = await joinMutation.mutateAsync({
        data: { username: username.trim(), gender, age, country: country.code }
      });

      login({
        userId: response.userId,
        username: response.username,
        gender: response.gender as 'Male' | 'Female',
        age: response.age,
        country: response.country ?? country.code,
      });

      setLocation('/users');
    } catch (err: any) {
      setErrorMsg(err.message || "Username is already taken or invalid.");
    }
  };

  if (!isLoaded || user) return null;

  return (
    <>
      {/* Compliance Advisory Modal */}
      <AnimatePresence>
        {showAdvisory && <AdvisoryModal onAccept={handleAdvisoryAccept} />}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background px-4 py-12">
        {/* Background */}
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
          className="relative z-10 w-full max-w-md"
        >
          {/* Join Card */}
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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
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

              {/* Gender */}
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


              {/* Age */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">Your Age</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAge(a => Math.max(18, a - 1))}
                    disabled={age <= 18 || joinMutation.isPending}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-secondary/50 border border-white/10 text-foreground text-xl font-bold hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all select-none"
                  >
                    −
                  </button>
                  <div className="flex-1 flex flex-col items-center justify-center bg-secondary/50 border border-white/10 rounded-xl py-2">
                    <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{age}</span>
                    <span className="text-xs text-muted-foreground mt-1">years old</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAge(a => Math.min(99, a + 1))}
                    disabled={age >= 99 || joinMutation.isPending}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-secondary/50 border border-white/10 text-foreground text-xl font-bold hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all select-none"
                  >
                    +
                  </button>
                </div>
                <input
                  type="range"
                  min={18}
                  max={99}
                  step={1}
                  value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  disabled={joinMutation.isPending}
                  className="w-full accent-primary disabled:opacity-50 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>18</span>
                  <span>99</span>
                </div>
              </div>

              {/* Country */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">Your Country</label>
                <CountryDropdown
                  value={country}
                  onChange={setCountry}
                  disabled={joinMutation.isPending}
                />
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
      {/* ── About Section ────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 mt-10 mb-6">
        <p className="text-sm text-muted-foreground/70 text-center leading-relaxed">
          AnoChat.in is a privacy-first platform designed for spontaneous, meaningful connections. Built for the modern web, we bridge the gap between global anonymity and local relevance, allowing you to strike up candid conversations without the digital footprint. Whether you're looking for a quick debate, a friendly chat, or a global perspective, our streamlined interface ensures your privacy is the priority and the conversation is the focus.
        </p>
      </div>

      {/* ── FAQ Section ──────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 mb-10">
        <h2 className="text-lg font-bold text-foreground text-center mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {[
            {
              q: "Is AnoChat.in really anonymous?",
              a: "Yes. We do not require emails, phone numbers, or social logins. Conversations are ephemeral and session-based."
            },
            {
              q: "What is the 3-Hour Takedown Rule?",
              a: "In compliance with IT Rules 2026, any reported deepfakes or non-consensual imagery are reviewed and removed within 2-3 hours."
            },
            {
              q: "Can I block someone?",
              a: "Absolutely. Use the 'Block' icon in the chat header to instantly end the session and prevent that user from matching with you again."
            },
            {
              q: "Is this service free?",
              a: "Yes, the core chat experience is 100% free."
            },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full border-t border-white/5 bg-card/30 backdrop-blur-sm mt-4">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Platform */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Platform</p>
              <ul className="space-y-2">
                <li><a href="/#join" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a></li>
                <li><a href="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a></li>
                <li><span className="text-sm text-muted-foreground/50 cursor-default">Roadmap</span></li>
                <li><span className="text-sm text-muted-foreground/50 cursor-default">Status</span></li>
              </ul>
            </div>
            {/* Support */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Support</p>
              <ul className="space-y-2">
                <li><a href="/safety.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Safety Tips</a></li>
                <li><a href="/contact.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Grievance Officer</a></li>
                <li><a href="/contact.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Legal</p>
              <ul className="space-y-2">
                <li><a href="/privacy.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="/terms.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="/safety.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Safety Guide</a></li>
                <li><a href="/terms.html#it-rules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">IT Rules 2026</a></li>
              </ul>
            </div>
            {/* Company */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Company</p>
              <ul className="space-y-2">
                <li><a href="/#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="/contact.html" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Grievance Officer</a></li>
                <li><span className="text-sm text-muted-foreground/50 cursor-default">Blog (soon)</span></li>
                <li><span className="text-sm text-muted-foreground/50 cursor-default">Careers (soon)</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-sm text-foreground">AnoChat.in</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} AnoChat.in · Privacy-first anonymous chat · India
            </p>
            <p className="text-xs text-muted-foreground">Made with ♥ in India</p>
          </div>
        </div>
      </footer>

    </>
  );
}
