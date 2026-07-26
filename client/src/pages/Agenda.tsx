import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { CalendarPlus, RefreshCw, Settings } from "lucide-react";
import { useEffect } from "react";

function range() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  to.setDate(to.getDate() + 45);
  return { from: from.getTime(), to: to.getTime() };
}

export default function AgendaPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const queryRange = useMemo(() => range(), []);

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const agenda = trpc.calendar.agenda.useQuery(queryRange, { enabled: isAuthenticated });
  const syncNow = trpc.calendar.syncNow.useMutation({
    onSuccess: () => {
      toast.success(t("calendar.syncDone"));
      void agenda.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const createEvent = trpc.calendar.createPersonalEvent.useMutation({
    onSuccess: () => {
      toast.success(t("calendar.eventCreated"));
      setShowCreate(false);
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      void agenda.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading || !isAuthenticated) {
    return (
      <AppLayout title={t("calendar.agendaTitle")}>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t("calendar.agendaTitle")}
      breadcrumb={[{ label: t("calendar.agendaTitle") }]}
    >
      <div className="page-shell max-w-3xl">
        <div className="page-header">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t("calendar.agendaTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("calendar.agendaHint")}</p>
          </div>
          <div className="page-actions">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Settings className="w-4 h-4 me-1.5" />
                <span className="truncate">{t("calendar.manageConnections")}</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={syncNow.isPending}
              onClick={() => syncNow.mutate(undefined)}
            >
              <RefreshCw className="w-4 h-4 me-1.5" />
              {t("calendar.syncNow")}
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => setShowCreate(true)}>
              <CalendarPlus className="w-4 h-4 me-1.5" />
              {t("calendar.addEvent")}
            </Button>
          </div>
        </div>

        {agenda.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (agenda.data || []).length === 0 ? (
          <div className="border border-border rounded-xl p-8 text-center text-muted-foreground">
            {t("calendar.emptyAgenda")}
          </div>
        ) : (
          <div className="space-y-2">
            {(agenda.data || []).map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.allDay
                      ? new Date(item.startsAt).toLocaleDateString()
                      : `${new Date(item.startsAt).toLocaleString()} – ${new Date(item.endsAt).toLocaleTimeString()}`}
                  </p>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">{item.sourceLabel || item.entityType}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.addEvent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("calendar.eventTitle")}</Label>
              <Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t("calendar.startsAt")}</Label>
              <Input
                className="mt-1.5"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("calendar.endsAt")}</Label>
              <Input
                className="mt-1.5"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={createEvent.isPending || !title || !startsAt || !endsAt}
              onClick={() =>
                createEvent.mutate({
                  title: title.trim(),
                  startsAt: new Date(startsAt).getTime(),
                  endsAt: new Date(endsAt).getTime(),
                })
              }
            >
              {createEvent.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
