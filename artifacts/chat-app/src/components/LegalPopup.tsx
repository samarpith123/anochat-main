import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";

const STORAGE_KEY = "anonchat_terms_agreed_2026";

export function LegalPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const agreed = localStorage.getItem(STORAGE_KEY);
    if (!agreed) {
      setVisible(true);
    }
  }, []);

  const handleAgree = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-card shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />

            <div className="p-7 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-tight">
                    Community Rules & Legal Notice
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">IT Rules 2026</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-7">
                By using this site, you agree to follow the{" "}
                <span className="text-foreground font-semibold">IT Rules 2026</span>.
                Sharing illegal synthetic content (deepfakes) or harassment will result in a{" "}
                <span className="text-destructive font-semibold">permanent ban</span> and may be
                reported to{" "}
                <span className="text-foreground font-semibold">I4C authorities</span>.
              </p>

              <button
                onClick={handleAgree}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                I Agree — Enter Site
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
