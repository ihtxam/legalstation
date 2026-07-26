import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export default function AnnouncementPopup() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const enabled = Boolean(user) && user?.role !== "superadmin";
  const { data: items } = trpc.announcements.activeForMe.useQuery(undefined, {
    enabled,
    refetchInterval: 5 * 60 * 1000,
  });
  const dismiss = trpc.announcements.dismiss.useMutation();
  const [index, setIndex] = useState(0);

  const queue = useMemo(() => items || [], [items]);
  const current = queue[index];

  useEffect(() => {
    setIndex(0);
  }, [queue.length]);

  if (!enabled || !current) return null;

  const severityClass =
    current.severity === "critical"
      ? "bg-red-100 text-red-800"
      : current.severity === "warning"
        ? "bg-amber-100 text-amber-900"
        : "bg-sky-100 text-sky-900";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          dismiss.mutate({ announcementId: current.id });
          setIndex((i) => i + 1);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={severityClass}>{current.severity}</Badge>
            {queue.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {index + 1} / {queue.length}
              </span>
            )}
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground/80 pt-2">
            {current.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              dismiss.mutate({ announcementId: current.id });
              setIndex((i) => i + 1);
            }}
            disabled={dismiss.isPending}
          >
            {t("announcements.dismiss")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
