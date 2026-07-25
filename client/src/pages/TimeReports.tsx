import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";
import LexLayout from "@/components/LexLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronLeft, ChevronRight, Pause, Play, Plus, Send, Trash2 } from "lucide-react";

function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function entryAmount(
  durationMinutes: number,
  entryRate: string | number | null | undefined,
  defaultRate: number
) {
  const rate =
    entryRate != null && entryRate !== "" ? parseFloat(String(entryRate)) : defaultRate;
  if (!rate || !Number.isFinite(rate)) return 0;
  return Math.round((durationMinutes / 60) * rate * 100) / 100;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "billed") return "default";
  if (status === "submitted") return "outline";
  return "secondary";
}

export default function TimeReportsPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(currentDate), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(currentDate), "yyyy-MM-dd"));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("entries");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerCaseId, setTimerCaseId] = useState<string>("");
  const [timerDescription, setTimerDescription] = useState("");

  // Manual entry
  const [manualCaseId, setManualCaseId] = useState<string>("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualMinutes, setManualMinutes] = useState("60");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hourlyRateInput, setHourlyRateInput] = useState("");

  // Invoice from entries
  const [invoiceClientId, setInvoiceClientId] = useState<string>("");
  const [invoiceDueDate, setInvoiceDueDate] = useState(
    format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd")
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const { data: cases } = trpc.cases.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: clients } = trpc.clients.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: rateData } = trpc.timeEntries.getHourlyRate.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();

  const listQuery = trpc.timeEntries.list.useQuery(
    { from: dateFrom, to: dateTo, mineOnly: true },
    { enabled: isAuthenticated }
  );
  const summaryQuery = trpc.timeEntries.summary.useQuery(
    { from: dateFrom, to: dateTo, mineOnly: true },
    { enabled: isAuthenticated }
  );

  const createEntry = trpc.timeEntries.create.useMutation({
    onSuccess: async () => {
      toast.success("Time entry saved as draft");
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitMany = trpc.timeEntries.submitMany.useMutation({
    onSuccess: async (r) => {
      toast.success(`Submitted ${r.submitted} entr${r.submitted === 1 ? "y" : "ies"}`);
      setSelectedIds([]);
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntry = trpc.timeEntries.delete.useMutation({
    onSuccess: async () => {
      toast.success("Entry deleted");
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setRate = trpc.timeEntries.setHourlyRate.useMutation({
    onSuccess: async () => {
      toast.success("Hourly rate saved — used when invoicing your time");
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createInvoice = trpc.timeEntries.createInvoiceFromEntries.useMutation({
    onSuccess: (inv) => {
      toast.success("Draft invoice created from time entries");
      setSelectedIds([]);
      if (inv?.id) navigate(`/invoices/${inv.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (rateData?.hourlyRate != null) setHourlyRateInput(String(rateData.hourlyRate));
  }, [rateData?.hourlyRate]);

  const entries = listQuery.data ?? [];
  const summary = summaryQuery.data;
  const defaultRate = summary?.defaultHourlyRate ?? rateData?.hourlyRate ?? 0;
  const hasHourlyRate = Number(defaultRate) > 0;

  const caseNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of cases ?? []) map.set(c.id, c.title);
    return map;
  }, [cases]);

  const invoiceableEntries = useMemo(
    () => entries.filter((e) => e.billable && (e.status === "draft" || e.status === "submitted")),
    [entries]
  );

  const selectedInvoiceable = useMemo(
    () => invoiceableEntries.filter((e) => selectedIds.includes(e.id)),
    [invoiceableEntries, selectedIds]
  );

  const selectedTotal = useMemo(
    () =>
      selectedInvoiceable.reduce(
        (sum, e) => sum + entryAmount(e.durationMinutes, e.hourlyRate, Number(defaultRate) || 0),
        0
      ),
    [selectedInvoiceable, defaultRate]
  );

  const suggestCaseId = selectedInvoiceable[0]?.caseId ?? invoiceableEntries[0]?.caseId;
  const { data: suggestCase } = trpc.cases.get.useQuery(
    { id: suggestCaseId! },
    { enabled: isAuthenticated && !!suggestCaseId && activeTab === "invoice" && !invoiceClientId }
  );

  // When opening the Invoice tab, pre-select all invoiceable entries in range
  useEffect(() => {
    if (activeTab !== "invoice") return;
    if (invoiceableEntries.length === 0) return;
    setSelectedIds((prev) => {
      const invoiceableIds = new Set(invoiceableEntries.map((e) => e.id));
      const stillValid = prev.filter((id) => invoiceableIds.has(id));
      if (stillValid.length > 0) return stillValid;
      return invoiceableEntries.map((e) => e.id);
    });
  }, [activeTab, invoiceableEntries]);

  // Suggest client from the case assignment on the first selected entry
  useEffect(() => {
    if (invoiceClientId || !suggestCase?.assignments) return;
    const clientAssign = suggestCase.assignments.find(
      (a) => a.assignmentType === "client" && a.clientId != null
    );
    if (clientAssign?.clientId) setInvoiceClientId(String(clientAssign.clientId));
  }, [suggestCase, invoiceClientId]);

  const previousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    setCurrentDate(newDate);
    setDateFrom(format(startOfMonth(newDate), "yyyy-MM-dd"));
    setDateTo(format(endOfMonth(newDate), "yyyy-MM-dd"));
    setSelectedIds([]);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    setDateFrom(format(startOfMonth(newDate), "yyyy-MM-dd"));
    setDateTo(format(endOfMonth(newDate), "yyyy-MM-dd"));
    setSelectedIds([]);
  };

  const saveTimerEntry = () => {
    if (!timerCaseId) {
      toast.error("Select a case for the timer");
      return;
    }
    if (!timerDescription.trim()) {
      toast.error("Add a description");
      return;
    }
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    createEntry.mutate({
      caseId: Number(timerCaseId),
      description: timerDescription.trim(),
      durationMinutes: minutes,
      date: format(new Date(), "yyyy-MM-dd"),
      billable: true,
    });
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerDescription("");
  };

  const saveManualEntry = () => {
    if (!manualCaseId) {
      toast.error("Select a case");
      return;
    }
    createEntry.mutate({
      caseId: Number(manualCaseId),
      description: manualDescription.trim() || "Time entry",
      durationMinutes: Math.max(1, parseInt(manualMinutes, 10) || 1),
      date: manualDate,
      billable: true,
    });
    setManualDescription("");
  };

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const toggleAllInvoiceable = (checked: boolean) => {
    setSelectedIds(checked ? invoiceableEntries.map((e) => e.id) : []);
  };

  const utilizationRate =
    summary && summary.totalHours > 0
      ? ((summary.billableHours / summary.totalHours) * 100).toFixed(1)
      : "0";

  const createInvoiceFromSelection = () => {
    if (!hasHourlyRate) {
      toast.error("Set your hourly rate (top right) before creating an invoice");
      return;
    }
    if (!invoiceClientId) {
      toast.error("Select a client for the invoice");
      return;
    }
    if (selectedInvoiceable.length === 0) {
      toast.error("Select at least one billable entry");
      return;
    }
    createInvoice.mutate({
      entryIds: selectedInvoiceable.map((e) => e.id),
      clientId: Number(invoiceClientId),
      caseId: selectedInvoiceable[0]?.caseId,
      dueDate: new Date(invoiceDueDate).getTime(),
      vatRate: 7.7,
    });
  };

  return (
    <LexLayout breadcrumb={[{ label: "Time Reports" }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Time Reports</h1>
          <p className="text-muted-foreground mt-2">
            1) Set your hourly rate · 2) Log time · 3) Invoice billable entries
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Timer</CardTitle>
              <CardDescription>Start a timer or log time manually (saved as draft)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-mono tabular-nums">
                  {formatDuration(Math.floor(timerSeconds / 60))}
                  <span className="text-muted-foreground text-lg">
                    :{String(timerSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
                <Button
                  variant={timerRunning ? "secondary" : "default"}
                  onClick={() => setTimerRunning((r) => !r)}
                >
                  {timerRunning ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                  {timerRunning ? "Pause" : "Start"}
                </Button>
                <Button variant="outline" disabled={timerSeconds < 1} onClick={saveTimerEntry}>
                  Save entry
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Case</Label>
                  <Select value={timerCaseId} onValueChange={setTimerCaseId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select case" />
                    </SelectTrigger>
                    <SelectContent>
                      {(cases ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    className="mt-1.5"
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder="What are you working on?"
                  />
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Case</Label>
                  <Select value={manualCaseId} onValueChange={setManualCaseId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Case" />
                    </SelectTrigger>
                    <SelectContent>
                      {(cases ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Minutes</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={1}
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    className="mt-1.5"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={saveManualEntry} disabled={createEntry.isPending}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add
                  </Button>
                </div>
                <div className="md:col-span-4">
                  <Label>Description</Label>
                  <Textarea
                    className="mt-1.5"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={!hasHourlyRate ? "border-amber-400 bg-amber-50/40" : undefined}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Your hourly rate
                {!hasHourlyRate && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              </CardTitle>
              <CardDescription>
                Set this once — invoices use it for your billable time (CHF / hour)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasHourlyRate && (
                <p className="text-sm text-amber-800">
                  Required before creating an invoice from time entries.
                </p>
              )}
              <div>
                <Label htmlFor="hourly-rate">CHF per hour</Label>
                <Input
                  id="hourly-rate"
                  className="mt-1.5"
                  type="number"
                  min={1}
                  step="0.01"
                  value={hourlyRateInput}
                  onChange={(e) => setHourlyRateInput(e.target.value)}
                  placeholder="e.g. 350"
                />
              </div>
              <Button
                className="w-full"
                variant={hasHourlyRate ? "outline" : "default"}
                disabled={setRate.isPending || !hourlyRateInput}
                onClick={() => setRate.mutate({ hourlyRate: parseFloat(hourlyRateInput) })}
              >
                {hasHourlyRate ? "Update rate" : "Save hourly rate"}
              </Button>
              {hasHourlyRate && (
                <p className="text-xs text-muted-foreground">
                  Current: {formatCHF(Number(defaultRate))} / hour
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm">Date From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Date To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-end gap-2 md:col-span-2">
                <Button variant="outline" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center text-sm font-medium">
                  {format(currentDate, "MMMM yyyy")}
                </div>
                <Button variant="outline" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary?.totalHours?.toFixed(1) ?? "0"}</div>
              <div className="text-xs text-muted-foreground">Total hours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary?.billableHours?.toFixed(1) ?? "0"}</div>
              <div className="text-xs text-muted-foreground">Billable hours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatCHF(summary?.revenue ?? 0)}</div>
              <div className="text-xs text-muted-foreground">Est. revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{utilizationRate}%</div>
              <div className="text-xs text-muted-foreground">Utilization</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="entries">Entries</TabsTrigger>
            <TabsTrigger value="invoice">
              Create invoice
              {invoiceableEntries.length > 0 ? ` (${invoiceableEntries.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="entries" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={selectedIds.length === 0 || submitMany.isPending}
                onClick={() => submitMany.mutate({ ids: selectedIds })}
              >
                <Send className="w-4 h-4 mr-1.5" /> Submit selected
              </Button>
              <p className="text-sm text-muted-foreground">
                Optional: mark drafts as submitted. Or go to Create invoice — drafts can be billed directly.
              </p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Date</TableHead>
                    <TableHead>Case</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No time entries in this date range. Log time above, or widen the month filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(entry.id)}
                            onCheckedChange={(v) => toggleSelected(entry.id, v === true)}
                            disabled={entry.status === "billed"}
                          />
                        </TableCell>
                        <TableCell>{format(new Date(entry.date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{caseNameById.get(entry.caseId) ?? `#${entry.caseId}`}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                        <TableCell>{formatDuration(entry.durationMinutes)}</TableCell>
                        <TableCell>
                          {entry.billable
                            ? formatCHF(
                                entryAmount(entry.durationMinutes, entry.hourlyRate, Number(defaultRate) || 0)
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.status !== "billed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEntry.mutate({ id: entry.id })}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="invoice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create invoice from time entries</CardTitle>
                <CardDescription>
                  Select billable drafts or submitted entries below, choose a client, then create a draft invoice.
                  Drafts are submitted automatically when invoiced.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasHourlyRate && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      Set <strong>Your hourly rate</strong> (card above) before invoicing. Without it, amounts cannot be calculated.
                    </div>
                  </div>
                )}

                {invoiceableEntries.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-8 text-center space-y-2">
                    <p className="font-medium text-foreground">No billable entries to invoice in this range</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Log time with the timer or manual form (Entries stay as <em>draft</em>).
                      Already billed entries do not appear here. Try another month if your work was logged earlier.
                    </p>
                    <Button variant="outline" className="mt-2" onClick={() => setActiveTab("entries")}>
                      Go to Entries
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                selectedInvoiceable.length > 0 &&
                                selectedInvoiceable.length === invoiceableEntries.length
                              }
                              onCheckedChange={(v) => toggleAllInvoiceable(v === true)}
                              aria-label="Select all invoiceable entries"
                            />
                          </TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Case</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceableEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(entry.id)}
                                onCheckedChange={(v) => toggleSelected(entry.id, v === true)}
                              />
                            </TableCell>
                            <TableCell>{format(new Date(entry.date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{caseNameById.get(entry.caseId) ?? `#${entry.caseId}`}</TableCell>
                            <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                            <TableCell>{formatDuration(entry.durationMinutes)}</TableCell>
                            <TableCell>
                              {formatCHF(
                                entryAmount(entry.durationMinutes, entry.hourlyRate, Number(defaultRate) || 0)
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {selectedInvoiceable.length} entr{selectedInvoiceable.length === 1 ? "y" : "ies"} selected
                  {selectedInvoiceable.length > 0 ? ` · ${formatCHF(selectedTotal)} excl. VAT` : ""}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="invoice-client">Client</Label>
                    <Select value={invoiceClientId} onValueChange={setInvoiceClientId}>
                      <SelectTrigger id="invoice-client" className="mt-1.5">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clients ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.type === "company"
                              ? c.companyName
                              : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="invoice-due">Due date</Label>
                    <Input
                      id="invoice-due"
                      className="mt-1.5"
                      type="date"
                      value={invoiceDueDate}
                      onChange={(e) => setInvoiceDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  disabled={
                    selectedInvoiceable.length === 0 ||
                    !invoiceClientId ||
                    !hasHourlyRate ||
                    createInvoice.isPending
                  }
                  onClick={createInvoiceFromSelection}
                >
                  {createInvoice.isPending ? "Creating…" : "Create draft invoice"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}
