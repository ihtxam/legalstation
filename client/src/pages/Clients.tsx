import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, User, Building2, Mail, Phone, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export default function ClientsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "company">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "invited" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    type: "individual" as "individual" | "company",
    firstName: "", lastName: "", companyName: "", contactPerson: "",
    email: "", phone: "", address: "", city: "", postalCode: "", country: "Switzerland",
  });

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery(
    { search: search || undefined, type: typeFilter === "all" ? undefined : typeFilter, status: statusFilter === "all" ? undefined : statusFilter },
    { enabled: isAuthenticated }
  );

  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => { toast.success(t("clients.created")); setShowCreate(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const displayName = (c: typeof clients extends (infer T)[] | undefined ? T : never) => {
    if (!c) return "";
    return c.type === "company" ? (c.companyName ?? t("clients.unnamedCompany")) : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || t("clients.unnamedClient");
  };

  return (
    <AppLayout title={t("clients.title")} breadcrumb={[{ label: t("clients.title") }]}>
      <div className="page-shell max-w-6xl">
        {/* Header */}
        <div className="page-header">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t("clients.title")}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{t("clients.count", { count: clients?.length ?? 0 })}</p>
          </div>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> {t("clients.new")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem] w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("clients.search")} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allTypes")}</SelectItem>
              <SelectItem value="individual">{t("common.individual")}</SelectItem>
              <SelectItem value="company">{t("common.company")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
              <SelectItem value="invited">{t("common.invited")}</SelectItem>
              <SelectItem value="active">{t("common.active")}</SelectItem>
              <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Client list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1,2,3,4,5].map(i => <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>)}
            </div>
          ) : !clients?.length ? (
            <div className="py-16 text-center">
              <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">{t("clients.empty")}</p>
              <p className="text-muted-foreground text-sm mt-1">{t("clients.emptyHint")}</p>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("common.client")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("clients.colType")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("clients.colContact")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("clients.colStatus")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("clients.colCreated")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center shrink-0">
                          {c.type === "company" ? <Building2 className="w-4 h-4 text-[var(--color-navy)]" /> : <User className="w-4 h-4 text-[var(--color-navy)]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground text-sm">{displayName(c)}</p>
                            {c.accessType === "subscriber" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t("packages.subscriberBadge")}
                              </Badge>
                            )}
                          </div>
                          {c.type === "company" && c.contactPerson && <p className="text-xs text-muted-foreground">{c.contactPerson}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{t(`common.${c.type}`)}</td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
                        {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{format(c.createdAt, "dd MMM yyyy")}</td>
                    <td className="px-4 py-3.5"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* Create client dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("clients.new")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("common.type")}</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">{t("common.individual")}</SelectItem>
                  <SelectItem value="company">{t("common.company")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "individual" ? (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("clients.firstName")}</Label><Input className="mt-1.5" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                <div><Label>{t("clients.lastName")}</Label><Input className="mt-1.5" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div><Label>{t("clients.companyName")}</Label><Input className="mt-1.5" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} /></div>
                <div><Label>{t("clients.contactPerson")}</Label><Input className="mt-1.5" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("clients.email")}</Label><Input type="email" className="mt-1.5" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>{t("clients.phone")}</Label><Input className="mt-1.5" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>{t("clients.address")}</Label><Input className="mt-1.5" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("clients.city")}</Label><Input className="mt-1.5" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>{t("clients.postalCode")}</Label><Input className="mt-1.5" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={createClient.isPending}
              onClick={() => createClient.mutate({ ...form, email: form.email || undefined })}>
              {createClient.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
