import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "consultation",
  "proposal",
  "won",
  "lost",
] as const;

type LeadStage = (typeof STAGES)[number];

export default function FirmLeadsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: leads, isLoading } = trpc.firmLeads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState<number | null>(null);
  const [createCase, setCreateCase] = useState(true);
  const [caseTitle, setCaseTitle] = useState("");
  const [form, setForm] = useState({
    contactName: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    notes: "",
  });

  const create = trpc.firmLeads.create.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.leadCreated"));
      setCreateOpen(false);
      setForm({ contactName: "", email: "", phone: "", company: "", source: "", notes: "" });
      await utils.firmLeads.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setStage = trpc.firmLeads.setStage.useMutation({
    onSuccess: () => utils.firmLeads.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const convert = trpc.firmLeads.convert.useMutation({
    onSuccess: (r) => {
      toast.success(t("crm.leadConverted"));
      setConvertLeadId(null);
      utils.firmLeads.list.invalidate();
      if (r.clientId) navigate(`/clients/${r.clientId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s, [] as NonNullable<typeof leads>])) as Record<
      LeadStage,
      NonNullable<typeof leads>
    >;
    for (const lead of leads || []) {
      map[lead.stage as LeadStage].push(lead);
    }
    return map;
  }, [leads]);

  const stageLabel = (s: LeadStage) => t(`crm.leadStage.${s}`);

  return (
    <LexLayout breadcrumb={[{ label: t("nav.leads") }]}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">{t("crm.leadsTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("crm.leadsHint")}</p>
          </div>
          <Button className="bg-[var(--color-navy)] text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" /> {t("crm.newLead")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {STAGES.map((stage) => (
              <div
                key={stage}
                className="min-w-[240px] w-[240px] shrink-0 rounded-xl border border-border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{stageLabel(stage)}</p>
                  <Badge variant="secondary">{byStage[stage].length}</Badge>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {byStage[stage].map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <p className="font-medium text-sm">{lead.contactName}</p>
                      {lead.company && (
                        <p className="text-xs text-muted-foreground">{lead.company}</p>
                      )}
                      {lead.email && (
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      )}
                      <Select
                        value={lead.stage}
                        onValueChange={(v) =>
                          setStage.mutate({ id: lead.id, stage: v as LeadStage })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {stageLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!lead.convertedClientId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs"
                          onClick={() => {
                            setConvertLeadId(lead.id);
                            setCaseTitle(`Matter — ${lead.company || lead.contactName}`);
                            setCreateCase(true);
                          }}
                        >
                          <UserPlus className="w-3.5 h-3.5 me-1" /> {t("crm.convert")}
                        </Button>
                      )}
                      {lead.convertedClientId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full h-8 text-xs"
                          onClick={() => navigate(`/clients/${lead.convertedClientId}`)}
                        >
                          {t("crm.viewClient")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.newLead")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{t("crm.contactName")}</Label>
              <Input
                className="mt-1"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("settings.email")}</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("settings.phone")}</Label>
                <Input
                  className="mt-1"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("crm.company")}</Label>
                <Input
                  className="mt-1"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("crm.source")}</Label>
                <Input
                  className="mt-1"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("common.notes")}</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={!form.contactName.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  contactName: form.contactName.trim(),
                  email: form.email || null,
                  phone: form.phone || null,
                  company: form.company || null,
                  source: form.source || null,
                  notes: form.notes || null,
                })
              }
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertLeadId != null} onOpenChange={(o) => !o && setConvertLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.convertTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t("crm.convertHint")}</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={createCase} onCheckedChange={(c) => setCreateCase(Boolean(c))} />
              {t("crm.alsoCreateCase")}
            </label>
            {createCase && (
              <div>
                <Label>{t("crm.caseTitle")}</Label>
                <Input
                  className="mt-1"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLeadId(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={convert.isPending || convertLeadId == null}
              onClick={() =>
                convert.mutate({
                  leadId: convertLeadId!,
                  createCase,
                  caseTitle: createCase ? caseTitle || undefined : undefined,
                })
              }
            >
              {t("crm.convert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LexLayout>
  );
}
