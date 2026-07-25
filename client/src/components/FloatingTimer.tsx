import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FloatingTimer() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated && user?.role !== "superadmin",
  });
  const { data: timer } = trpc.timeEntries.activeTimer.useQuery(undefined, {
    enabled: Boolean(firmData),
    refetchInterval: 15_000,
  });
  const [localSeconds, setLocalSeconds] = useState(0);

  const pause = trpc.timeEntries.pauseTimer.useMutation({
    onSuccess: () => utils.timeEntries.activeTimer.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const resume = trpc.timeEntries.resumeTimer.useMutation({
    onSuccess: () => utils.timeEntries.activeTimer.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const stop = trpc.timeEntries.stopTimer.useMutation({
    onSuccess: async (r) => {
      toast.success(`Saved ${r.durationMinutes} min`);
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!timer) {
      setLocalSeconds(0);
      return;
    }
    setLocalSeconds(timer.elapsedSeconds);
    if (timer.isPaused) return;
    const id = window.setInterval(() => setLocalSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer?.id, timer?.isPaused, timer?.elapsedSeconds]);

  if (!firmData || !timer || user?.role === "superadmin") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex items-center gap-3 min-w-[260px]">
      <div className="w-9 h-9 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
        <Clock className="w-4 h-4 text-[var(--color-navy)]" />
      </div>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-xs text-muted-foreground truncate block hover:underline"
          onClick={() => navigate(`/cases/${timer.caseId}`)}
        >
          Case #{timer.caseId}
        </button>
        <p className="font-mono text-lg font-semibold tabular-nums">{formatClock(localSeconds)}</p>
      </div>
      <div className="flex items-center gap-1">
        {timer.isPaused ? (
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => resume.mutate()} title="Resume">
            <Play className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => pause.mutate()} title="Pause">
            <Pause className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          className="h-8 w-8 bg-[var(--color-navy)] text-white"
          onClick={() => stop.mutate({ save: true })}
          title="Stop & save"
        >
          <Square className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
