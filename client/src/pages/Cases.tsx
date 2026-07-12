import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
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

export default function CasesPage() {
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
    onSuccess: () => { toast.success("Case created"); setShowCreate(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const filteredCases = cases?.filter(c => {
    if (activeTab === "open") return c.status === "open" || c.status === "pending";
    return c.status === "closed" || c.status === "archived";
  }) ?? [];

  return (
    <LexLayout title="Cases" breadcrumb={[{ label: "Cases" }]}>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Cases</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{filteredCases.length} {activeTab} cases</p>
          </div>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New case
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="bg-muted">
              <TabsTrigger value="open">Open & Pending</TabsTrigger>
              <TabsTrigger value="closed">Closed & Archived</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search cases…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(CASE_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">{[1,2,3,4].map(i => <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>)}</div>
          ) : !filteredCases.length ? (
            <div className="py-16 text-center">
              <Briefcase className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No {activeTab} cases</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Case</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opened</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCases.map(c => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground text-sm">{c.title}</p>
                      {c.referenceNumber && <p className="text-xs text-muted-foreground mt-0.5">Ref: {c.referenceNumber}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{CASE_TYPE_LABELS[c.type]}</td>
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
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Case</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title <span className="text-destructive">*</span></Label><Input className="mt-1.5" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reference number</Label><Input className="mt-1.5" placeholder="e.g. 2024-001" value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CASE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1.5" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Court name</Label><Input className="mt-1.5" value={form.courtName} onChange={e => setForm(f => ({ ...f, courtName: e.target.value }))} /></div>
              <div><Label>Deadline</Label><Input type="date" className="mt-1.5" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!form.title || createCase.isPending}
              onClick={() => createCase.mutate({ ...form, deadline: form.deadline ? new Date(form.deadline).getTime() : undefined, referenceNumber: form.referenceNumber || undefined, description: form.description || undefined, courtName: form.courtName || undefined })}>
              {createCase.isPending ? "Creating…" : "Create case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LexLayout>
  );
}
