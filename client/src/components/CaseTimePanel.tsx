import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pause, Play, Plus, Square, Trash2, Edit2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CaseTimePanel({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const { data: entries, refetch } = trpc.timeEntries.list.useQuery({ caseId, mineOnly: true });
  const { data: activeTimer } = trpc.timeEntries.activeTimer.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const [description, setDescription] = useState("");
  const [manualMinutes, setManualMinutes] = useState("60");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [billable, setBillable] = useState(true);
  const [localSeconds, setLocalSeconds] = useState(0);
  const [editEntry, setEditEntry] = useState<(typeof entries extends (infer T)[] | undefined ? T : never) | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const timerForThisCase = activeTimer?.caseId === caseId ? activeTimer : null;

  const startTimer = trpc.timeEntries.startTimer.useMutation({
    onSuccess: async () => {
      toast.success("Timer started");
      await utils.timeEntries.activeTimer.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const pauseTimer = trpc.timeEntries.pauseTimer.useMutation({
    onSuccess: () => utils.timeEntries.activeTimer.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const resumeTimer = trpc.timeEntries.resumeTimer.useMutation({
    onSuccess: () => utils.timeEntries.activeTimer.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const stopTimer = trpc.timeEntries.stopTimer.useMutation({
    onSuccess: async (r) => {
      toast.success(`Saved ${r.durationMinutes} minutes`);
      await utils.timeEntries.invalidate();
      setDescription("");
    },
    onError: (e) => toast.error(e.message),
  });
  const createEntry = trpc.timeEntries.create.useMutation({
    onSuccess: async () => {
      toast.success("Time entry added");
      setDescription("");
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateEntry = trpc.timeEntries.update.useMutation({
    onSuccess: async () => {
      toast.success("Entry updated");
      setEditEntry(null);
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntry = trpc.timeEntries.delete.useMutation({
    onSuccess: async () => {
      toast.success("Entry deleted");
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!timerForThisCase) {
      setLocalSeconds(0);
      return;
    }
    setLocalSeconds(timerForThisCase.elapsedSeconds);
    setDescription(timerForThisCase.description || "");
    if (timerForThisCase.isPaused) return;
    const id = window.setInterval(() => setLocalSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerForThisCase?.id, timerForThisCase?.isPaused, timerForThisCase?.elapsedSeconds]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-foreground">Web timer</h3>
            <p className="text-sm text-muted-foreground">Start recording time on this case. Pause, edit, or save manually.</p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {timerForThisCase ? formatClock(localSeconds) : "00:00:00"}
          </p>
        </div>
        <Textarea
          placeholder="What are you working on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {!timerForThisCase ? (
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={startTimer.isPending || (activeTimer != null && activeTimer.caseId !== caseId)}
              onClick={() => startTimer.mutate({ caseId, description })}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" /> Start timer
            </Button>
          ) : (
            <>
              {timerForThisCase.isPaused ? (
                <Button variant="outline" onClick={() => resumeTimer.mutate()}>
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
                </Button>
              ) : (
                <Button variant="outline" onClick={() => pauseTimer.mutate()}>
                  <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                </Button>
              )}
              <Button
                className="bg-[var(--color-navy)] text-white"
                onClick={() => stopTimer.mutate({ save: true, description, billable })}
              >
                <Square className="w-3.5 h-3.5 mr-1.5" /> Stop & save
              </Button>
            </>
          )}
          {activeTimer && activeTimer.caseId !== caseId && (
            <p className="text-xs text-amber-700">A timer is already running on another case.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Manual time entry</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" className="mt-1.5" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
          </div>
          <div>
            <Label>Minutes</Label>
            <Input className="mt-1.5" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} />
          </div>
          <div className="flex items-end pb-2 gap-2">
            <Checkbox id="billable" checked={billable} onCheckedChange={(v) => setBillable(Boolean(v))} />
            <Label htmlFor="billable">Billable</Label>
          </div>
        </div>
        <Textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <Button
          disabled={!description.trim() || createEntry.isPending}
          onClick={() =>
            createEntry.mutate({
              caseId,
              description,
              durationMinutes: Math.max(1, parseInt(manualMinutes, 10) || 1),
              date: manualDate,
              billable,
            })
          }
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add entry
        </Button>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Time on this case</h3>
        {!entries?.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            No time entries yet
          </div>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{formatDuration(entry.durationMinutes)}</span>
                    <Badge variant="outline">{entry.status}</Badge>
                    {!entry.billable && <Badge variant="secondary">non-billable</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(entry.date), "dd MMM yyyy")}
                  </p>
                </div>
                {entry.status !== "billed" && (
                  <div className="flex gap-1">
                    <button
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditEntry(entry);
                        setEditMinutes(String(entry.durationMinutes));
                        setEditDesc(entry.description);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEntry.mutate({ id: entry.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit time entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Minutes</Label>
              <Input className="mt-1.5" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1.5" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button
              disabled={!editEntry || updateEntry.isPending}
              onClick={() =>
                editEntry &&
                updateEntry.mutate({
                  id: editEntry.id,
                  durationMinutes: Math.max(1, parseInt(editMinutes, 10) || 1),
                  description: editDesc,
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
