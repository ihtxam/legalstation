import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Briefcase, ArrowRight, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { CASE_TYPE_LABELS, CASE_STATUS_LABELS } from "@shared/types";
import { useTranslation } from "react-i18next";

const CASE_TYPE_I18N_KEYS: Record<string, string> = {
  civil: "cases.typeCivil",
  criminal: "cases.typeCriminal",
  corporate: "cases.typeCorporate",
  family: "cases.typeFamily",
  real_estate: "cases.typeRealEstate",
  employment: "cases.typeEmployment",
  tax: "cases.typeTax",
  immigration: "cases.typeImmigration",
  intellectual_property: "cases.typeIntellectualProperty",
  other: "cases.typeOther",
};

export default function CasesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", referenceNumber: "", type: "civil" as any, status: "open" as any,
    description: "", courtName: "", courtFileNumber: "", deadline: "",
  });

  const { data: cases, isLoading, refetch } = trpc.cases.list.useQuery(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter as any : undefined },
    { enabled: isAuthenticated }
  );
  const createCase = trpc.cases.create.useMutation({
    onSuccess: () => { toast.success(t("cases.created")); setShowCreate(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const filteredCases = cases?.filter(c => {
    if (activeTab === "open") return c.status === "open" || c.status === "pending";
    return c.status === "closed" || c.status === "archived";
  }) ?? [];
  const activeTabLabel = activeTab === "open" ? t("common.open").toLowerCase() : t("common.closed").toLowerCase();

  return (
    <AppLayout title={t("cases.title")} breadcrumb={[{ label: t("cases.title") }]}>
      <div className="page-shell max-w-6xl">
        <div className="page-header">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t("cases.title")}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{t("cases.count", { count: filteredCases.length, tab: activeTabLabel })}</p>
          </div>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> {t("cases.new")}
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="bg-muted">
              <TabsTrigger value="open">{t("cases.openPending")}</TabsTrigger>
              <TabsTrigger value="closed">{t("cases.closedArchived")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("cases.search")} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
              {Object.keys(CASE_STATUS_LABELS).map((v) => <SelectItem key={v} value={v}>{t(`common.${v}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">{[1,2,3,4].map(i => <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>)}</div>
          ) : !filteredCases.length ? (
            <div className="py-16 text-center">
              <Briefcase className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">{t("cases.empty", { tab: activeTabLabel })}</p>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("cases.colCase")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("cases.colType")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("cases.colStatus")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("cases.colDeadline")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("cases.colOpened")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCases.map(c => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground text-sm">{c.title}</p>
                      {c.referenceNumber && <p className="text-xs text-muted-foreground mt-0.5">{t("cases.referencePrefix")} {c.referenceNumber}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{t(CASE_TYPE_I18N_KEYS[c.type] ?? "cases.typeOther")}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">
                      {c.deadline ? <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(c.deadline, "dd MMM yyyy")}</span> : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{format(c.openedAt, "dd MMM yyyy")}</td>
                    <td className="px-4 py-3.5"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("cases.new")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{t("cases.formTitle")} <span className="text-destructive">*</span></Label><Input className="mt-1.5" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("cases.formReference")}</Label><Input className="mt-1.5" placeholder="e.g. 2024-001" value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} /></div>
              <div>
                <Label>{t("cases.formType")}</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(CASE_TYPE_LABELS).map((v) => <SelectItem key={v} value={v}>{t(CASE_TYPE_I18N_KEYS[v] ?? "cases.typeOther")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("cases.formDescription")}</Label><Textarea className="mt-1.5" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("cases.formCourt")}</Label><Input className="mt-1.5" value={form.courtName} onChange={e => setForm(f => ({ ...f, courtName: e.target.value }))} /></div>
              <div><Label>{t("cases.formDeadline")}</Label><Input type="date" className="mt-1.5" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!form.title || createCase.isPending}
              onClick={() => createCase.mutate({ ...form, deadline: form.deadline ? new Date(form.deadline).getTime() : undefined, referenceNumber: form.referenceNumber || undefined, description: form.description || undefined, courtName: form.courtName || undefined })}>
              {createCase.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
