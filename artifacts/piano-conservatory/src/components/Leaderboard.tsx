import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  display_name: string;
  total_seconds: string;
  session_count: string;
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

interface Props {
  roomId: string;
  currentUserName?: string;
  className?: string;
}

export function Leaderboard({ roomId, currentUserName, className }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard || []);
        setLastUpdated(new Date());
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const total = entries.reduce((acc, e) => acc + parseInt(e.total_seconds), 0);

  return (
    <div className={cn("bg-card border-4 border-foreground rounded-2xl overflow-hidden cartoon-shadow", className)}>
      <div className="bg-primary/10 border-b-4 border-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-base">Today's Leaders</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 rounded-full"
          onClick={fetchLeaderboard}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <div className="text-3xl mb-2">🎹</div>
            <p>No practice yet today.</p>
            <p className="text-xs mt-0.5">Open the piano lid to start!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {entries.map((entry, i) => {
              const secs = parseInt(entry.total_seconds);
              const pct = total > 0 ? (secs / total) * 100 : 0;
              const isMe = currentUserName?.toLowerCase() === entry.display_name.toLowerCase();
              return (
                <motion.div
                  key={entry.display_name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "relative rounded-xl border-2 p-2 overflow-hidden",
                    i === 0 ? "border-yellow-400 bg-yellow-50" : isMe ? "border-primary bg-primary/5" : "border-muted bg-muted/30"
                  )}
                >
                  {/* Progress bar */}
                  <div
                    className={cn(
                      "absolute inset-0 opacity-20",
                      i === 0 ? "bg-yellow-300" : "bg-primary"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg w-7 text-center flex-shrink-0">
                      {MEDALS[i] || `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-bold text-sm truncate", isMe && "text-primary")}>
                        {entry.display_name}
                        {isMe && <span className="ml-1 text-xs font-normal text-primary/70">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.session_count} session{parseInt(entry.session_count) !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="font-display font-bold text-sm flex-shrink-0">
                      {fmtDuration(secs)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {lastUpdated && (
        <div className="px-3 pb-2 text-xs text-muted-foreground text-center">
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
