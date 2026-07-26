import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Copy, CreditCard } from "lucide-react";

export function FirmAdyenSettings() {
  const { t } = useTranslation();
  const settings = trpc.adyen.getFirmSettings.useQuery();
  const save = trpc.adyen.upsertFirmSettings.useMutation({
    onSuccess: async () => {
      toast.success(t("adyen.saved"));
      await settings.refetch();
      setApiKey("");
      setHmacKey("");
    },
    onError: (e) => toast.error(e.message),
  });

  const [merchantAccount, setMerchantAccount] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [hmacKey, setHmacKey] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!settings.data) return;
    setMerchantAccount(settings.data.merchantAccount || "");
    setClientKey(settings.data.clientKey || "");
    setEnvironment(settings.data.environment === "live" ? "live" : "test");
    setIsActive(Boolean(settings.data.isActive));
  }, [settings.data]);

  if (settings.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const data = settings.data;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            {t("adyen.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{t("adyen.hint")}</p>
        </div>
        <div className="flex gap-2">
          {data?.configured ? (
            <Badge variant={data.isActive ? "default" : "secondary"}>
              {data.isActive ? t("adyen.active") : t("adyen.inactive")}
            </Badge>
          ) : (
            <Badge variant="outline">{t("adyen.notConfigured")}</Badge>
          )}
          {data?.environment ? (
            <Badge variant="outline">{data.environment.toUpperCase()}</Badge>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">{t("adyen.webhookTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("adyen.webhookHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs break-all flex-1 bg-background border rounded-md px-2 py-1.5">
            {data?.webhookUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!data?.webhookUrl) return;
              await navigator.clipboard.writeText(data.webhookUrl);
              toast.success(t("adyen.webhookCopied"));
            }}
          >
            <Copy className="w-3.5 h-3.5 me-1.5" />
            {t("adyen.copyWebhook")}
          </Button>
        </div>
        {data?.lastWebhookAt ? (
          <p className="text-xs text-muted-foreground">
            {t("adyen.lastWebhook", {
              date: new Date(data.lastWebhookAt).toLocaleString(),
            })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("adyen.noWebhookYet")}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{t("adyen.merchantAccount")}</Label>
          <Input
            className="mt-1.5"
            value={merchantAccount}
            onChange={(e) => setMerchantAccount(e.target.value)}
            placeholder="YourCompanyECOM"
          />
        </div>
        <div>
          <Label>{t("adyen.environment")}</Label>
          <Select
            value={environment}
            onValueChange={(v) => setEnvironment(v as "test" | "live")}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">{t("adyen.envTest")}</SelectItem>
              <SelectItem value="live">{t("adyen.envLive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between gap-3 pb-1">
          <div>
            <Label>{t("adyen.enableGateway")}</Label>
            <p className="text-xs text-muted-foreground mt-1">{t("adyen.enableHint")}</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <div className="sm:col-span-2">
          <Label>
            {t("adyen.apiKey")}
            {data?.hasApiKey ? (
              <span className="text-xs text-muted-foreground ms-2">({t("adyen.storedLeaveBlank")})</span>
            ) : null}
          </Label>
          <Input
            className="mt-1.5"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={data?.hasApiKey ? "••••••••" : "AQE..."}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>
            {t("adyen.hmacKey")}
            {data?.hasHmacKey ? (
              <span className="text-xs text-muted-foreground ms-2">({t("adyen.storedLeaveBlank")})</span>
            ) : null}
          </Label>
          <Input
            className="mt-1.5"
            type="password"
            autoComplete="off"
            value={hmacKey}
            onChange={(e) => setHmacKey(e.target.value)}
            placeholder={data?.hasHmacKey ? "••••••••" : t("adyen.hmacPlaceholder")}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("adyen.hmacHelp")}</p>
        </div>
        <div className="sm:col-span-2">
          <Label>{t("adyen.clientKey")}</Label>
          <Input
            className="mt-1.5"
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
            placeholder="test_XXXX..."
          />
          <p className="text-xs text-muted-foreground mt-1">{t("adyen.clientKeyHelp")}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!merchantAccount.trim() || save.isPending}
          onClick={() =>
            save.mutate({
              merchantAccount: merchantAccount.trim(),
              apiKey: apiKey.trim() || undefined,
              clientKey: clientKey.trim() || null,
              hmacKey: hmacKey.trim() || undefined,
              environment,
              isActive,
            })
          }
        >
          {save.isPending ? t("common.loading") : t("adyen.save")}
        </Button>
      </div>
    </div>
  );
}
