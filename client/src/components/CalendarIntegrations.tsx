import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Calendar, Link2, RefreshCw, Unplug } from "lucide-react";

export function CalendarIntegrations() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: status } = trpc.calendar.providersStatus.useQuery();
  const { data: connections, refetch } = trpc.calendar.listConnections.useQuery();
  const connectIcloud = trpc.calendar.connectIcloud.useMutation({
    onSuccess: async () => {
      toast.success(t("calendar.icloudConnected"));
      setAppleId("");
      setAppPassword("");
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const syncNow = trpc.calendar.syncNow.useMutation({
    onSuccess: () => {
      toast.success(t("calendar.syncDone"));
      void refetch();
      void utils.calendar.agenda.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const disconnect = trpc.calendar.disconnect.useMutation({
    onSuccess: async () => {
      toast.success(t("calendar.disconnected"));
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.calendar.updateConnection.useMutation({
    onSuccess: () => void refetch(),
    onError: (e) => toast.error(e.message),
  });

  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cal = params.get("calendar");
    if (cal === "connected") {
      toast.success(t("calendar.connected", { provider: params.get("provider") || "" }));
      window.history.replaceState({}, "", "/settings");
      void refetch();
    } else if (cal === "error") {
      toast.error(params.get("reason") || t("calendar.connectFailed"));
      window.history.replaceState({}, "", "/settings");
    }
  }, [refetch, t]);

  const connectedProviders = new Set((connections || []).map((c) => c.provider));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {t("calendar.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{t("calendar.hint")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="font-medium">Google Calendar</p>
          <p className="text-xs text-muted-foreground">{t("calendar.googleHint")}</p>
          {connectedProviders.has("google") ? (
            <p className="text-sm text-green-700">{t("calendar.alreadyConnected")}</p>
          ) : (
            <Button
              disabled={!status?.google}
              onClick={() => {
                window.location.href = "/api/oauth/calendar/google/start";
              }}
            >
              <Link2 className="w-4 h-4 me-1.5" />
              {status?.google ? t("calendar.connectGoogle") : t("calendar.notConfigured")}
            </Button>
          )}
        </div>

        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="font-medium">Outlook / Microsoft 365</p>
          <p className="text-xs text-muted-foreground">{t("calendar.outlookHint")}</p>
          {connectedProviders.has("microsoft") ? (
            <p className="text-sm text-green-700">{t("calendar.alreadyConnected")}</p>
          ) : (
            <Button
              disabled={!status?.microsoft}
              onClick={() => {
                window.location.href = "/api/oauth/calendar/microsoft/start";
              }}
            >
              <Link2 className="w-4 h-4 me-1.5" />
              {status?.microsoft ? t("calendar.connectOutlook") : t("calendar.notConfigured")}
            </Button>
          )}
        </div>
      </div>

      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="font-medium">iCloud Calendar</p>
        <p className="text-xs text-muted-foreground">{t("calendar.icloudHint")}</p>
        {!connectedProviders.has("icloud") ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t("calendar.appleId")}</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={appleId}
                onChange={(e) => setAppleId(e.target.value)}
                placeholder="name@icloud.com"
              />
            </div>
            <div>
              <Label>{t("calendar.appPassword")}</Label>
              <Input
                className="mt-1.5"
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                disabled={connectIcloud.isPending || !appleId || !appPassword}
                onClick={() =>
                  connectIcloud.mutate({ appleId: appleId.trim(), appPassword: appPassword.trim() })
                }
              >
                {connectIcloud.isPending ? t("common.loading") : t("calendar.connectIcloud")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-green-700">{t("calendar.alreadyConnected")}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">{t("calendar.connections")}</h4>
          <Button
            variant="outline"
            size="sm"
            disabled={syncNow.isPending || !connections?.length}
            onClick={() => syncNow.mutate(undefined)}
          >
            <RefreshCw className="w-3.5 h-3.5 me-1.5" />
            {syncNow.isPending ? t("common.loading") : t("calendar.syncNow")}
          </Button>
        </div>
        {(connections || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("calendar.noConnections")}</p>
        ) : (
          (connections || []).map((c) => (
            <div
              key={c.id}
              className="border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"
            >
              <div>
                <p className="font-medium capitalize">{c.provider}</p>
                <p className="text-sm text-muted-foreground">
                  {c.accountEmail || c.externalCalendarName || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.lastSyncedAt
                    ? t("calendar.lastSynced", { at: new Date(c.lastSyncedAt).toLocaleString() })
                    : t("calendar.neverSynced")}
                  {c.lastError ? ` · ${c.lastError}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={c.syncDirection}
                  onValueChange={(v) =>
                    update.mutate({ id: c.id, syncDirection: v as "both" | "push" | "pull" })
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">{t("calendar.directionBoth")}</SelectItem>
                    <SelectItem value="push">{t("calendar.directionPush")}</SelectItem>
                    <SelectItem value="pull">{t("calendar.directionPull")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => syncNow.mutate({ id: c.id })}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect.mutate({ id: c.id })}
                >
                  <Unplug className="w-3.5 h-3.5 me-1" />
                  {t("calendar.disconnect")}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
