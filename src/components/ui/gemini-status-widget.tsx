import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface KeyStatus {
  label: string;
  status: 'available' | 'cooling';
  cooldownSeconds: number;
  failCount: number;
}

interface SheetCache {
  cached: boolean;
  rows?: number;
  ttlSeconds?: number;
}

interface GeminiStatus {
  keys: KeyStatus[];
  sheetCache: SheetCache;
  timestamp: string;
}

const POLL_INTERVAL_MS = 8000; // poll every 8 seconds

export function GeminiStatusWidget() {
  const [status, setStatus] = useState<GeminiStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/gemini-status');
      if (res.ok) {
        const data: GeminiStatus = await res.json();
        setStatus(data);
        setLastUpdated(new Date());
      }
    } catch {
      // silently ignore — server may be restarting
    } finally {
      if (manual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  // Compute summary badge colour
  const coolingCount = status.keys.filter(k => k.status === 'cooling').length;
  const allCooling = coolingCount === status.keys.length;
  const someCooling = coolingCount > 0 && !allCooling;

  const badgeColor = allCooling
    ? 'bg-red-500'
    : someCooling
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  const badgeLabel = allCooling
    ? 'All Cooling'
    : someCooling
      ? `${coolingCount} Cooling`
      : 'All OK';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-5 right-5 z-50 select-none flex flex-col items-end"
    >
      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-72 bg-white/95 backdrop-blur-xl border border-[#E8E8E5] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#6057D7]/6 to-[#3FC2AC]/6 border-b border-[#F0F0ED]">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#6057D7]" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#1A1A19]">
                  Linker Status Report
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); fetchStatus(true); }}
                className="p-1 rounded-full hover:bg-[#F4F4F2] transition-colors"
                title="Refresh now"
              >
                <RefreshCw className={`w-3 h-3 text-[#8B8B86] ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Key rows */}
            <div className="px-4 py-3 space-y-2">
              {status.keys.map((key) => {
                const isCooling = key.status === 'cooling';
                return (
                  <div key={key.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCooling ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-xs font-semibold text-[#1A1A19]">{key.label}</span>
                      {key.failCount > 0 && (
                        <span className="text-[9px] text-[#8B8B86] font-medium">
                          ({key.failCount} fail{key.failCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {isCooling ? (
                        <span className="text-[10px] font-bold text-amber-600 tabular-nums">
                          ⏳ {key.cooldownSeconds}s
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600">Available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sheet cache row */}
            <div className="px-4 py-2.5 border-t border-[#F0F0ED] bg-[#FAFAF9]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#8B8B86] uppercase tracking-wider">
                  Sheet Cache
                </span>
                {status.sheetCache?.cached ? (
                  <span className="text-[10px] font-bold text-emerald-600">
                    {status.sheetCache.rows} rows · {status.sheetCache.ttlSeconds}s left
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#A0A09D]">Not cached</span>
                )}
              </div>
            </div>

            {/* Timestamp */}
            {lastUpdated && (
              <div className="px-4 py-2 border-t border-[#F0F0ED]">
                <p className="text-[9px] text-[#A0A09D] text-right">
                  Updated {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill trigger */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-xl border border-[#E8E8E5] rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      >
        {/* Key dots */}
        <div className="flex items-center gap-0.5">
          {status.keys.map((key) => (
            <span
              key={key.label}
              title={`${key.label}: ${key.status}${key.status === 'cooling' ? ` (${key.cooldownSeconds}s)` : ''}`}
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${key.status === 'cooling'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-500'
                }`}
            />
          ))}
        </div>

        {/* Summary badge */}
        <span className={`text-[9px] font-extrabold uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full ${badgeColor}`}>
          {badgeLabel}
        </span>

        <span className="text-[#8B8B86] group-hover:text-[#1A1A19] transition-colors">
          {expanded
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
          }
        </span>
      </button>
    </motion.div>
  );
}
