import { TriangleAlert, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { pendingAlerts, reportErrorsContact } from "../config/pendingAlerts";
import { CloseButton } from "./ui/close-button";

const activeAlerts = pendingAlerts.filter((a) => !a.resolved);

export function PendingAlertsPill({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (activeAlerts.length === 0) return null;

  const collapsedLabel =
    activeAlerts.length === 1
      ? "1 known issue"
      : `${activeAlerts.length} known issues`;

  return (
    <div className="flex flex-col items-center min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-w-0 truncate hover:opacity-90 transition-opacity cursor-pointer bg-amber-500/10 border border-amber-500/20 backdrop-blur-md"
        style={{
          boxShadow:
            "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 0 rgba(0, 0, 0, 0.1)",
        }}
        aria-expanded={open}
      >
        <TriangleAlert
          size={12}
          className="text-amber-700 flex-shrink-0"
          aria-hidden
        />
        <span className="text-amber-800 text-[11px] font-medium truncate">
          {collapsedLabel}
        </span>
        <ChevronDown
          size={12}
          className={`text-amber-700/70 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-2 rounded-2xl shadow-2xl overflow-hidden w-[min(360px,calc(100vw-3.5rem))] max-h-[70vh] flex flex-col border border-amber-500/20"
            style={{
              backgroundColor: "rgba(69, 26, 3, 0.97)",
              boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 0 rgba(0, 0, 0, 0.2)",
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-amber-500/20 flex-shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-medium text-white uppercase tracking-widest">
                Known issues
              </span>
              <CloseButton
                onClick={() => onOpenChange(false)}
                className="[&>svg]:text-white/60 hover:bg-amber-500/20"
              />
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="space-y-1">
                  <p className="text-white text-sm font-medium">
                    {alert.shortLabel}
                  </p>
                  <p className="text-white/80 text-[13px] leading-relaxed">
                    {alert.description}
                  </p>
                </div>
              ))}
              {reportErrorsContact.mailto && (
                <div className="pt-3 border-t border-amber-500/20 flex justify-center">
                  <a
                    href={`mailto:${reportErrorsContact.mailto}`}
                    className="w-full flex items-center justify-center px-3 py-2 rounded-xl text-xs font-medium text-white bg-amber-900/90 hover:bg-amber-800 border border-amber-700/50 transition-colors"
                  >
                    {reportErrorsContact.label}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
