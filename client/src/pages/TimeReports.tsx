import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(currentDate), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(currentDate), "yyyy-MM-dd"));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("entries");

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerCaseId, setTimerCaseId] = useState<string>("");
  const [timerDescription, setTimerDescription] = useState("");

  const [manualCaseId, setManualCaseId] = useState<string>("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualMinutes, setManualMinutes] = useState("60");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hourlyRateInput, setHourlyRateInput] = useState("");

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
      toast.success(t("timeReports.entrySaved"));
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitMany = trpc.timeEntries.submitMany.useMutation({
    onSuccess: async (r) => {
      toast.success(
        r.submitted === 1
          ? t("timeReports.submittedOne", { count: r.submitted })
          : t("timeReports.submittedMany", { count: r.submitted })
      );
      setSelectedIds([]);
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntry = trpc.timeEntries.delete.useMutation({
    onSuccess: async () => {
      toast.success(t("timeReports.entryDeleted"));
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setRate = trpc.timeEntries.setHourlyRate.useMutation({
    onSuccess: async () => {
      toast.success(t("timeReports.rateSaved"));
      await utils.timeEntries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createInvoice = trpc.timeEntries.createInvoiceFromEntries.useMutation({
    onSuccess: (inv) => {
      toast.success(t("timeReports.invoiceCreated"));
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
      toast.error(t("timeReports.selectCaseTimer"));
      return;
    }
    if (!timerDescription.trim()) {
      toast.error(t("timeReports.addDescription"));
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
      toast.error(t("timeReports.selectCaseManual"));
      return;
    }
    createEntry.mutate({
      caseId: Number(manualCaseId),
      description: manualDescription.trim() || t("timeReports.defaultDescription"),
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
      toast.error(t("timeReports.setRateFirst"));
      return;
    }
    if (!invoiceClientId) {
      toast.error(t("timeReports.selectClientInvoice"));
      return;
    }
    if (selectedInvoiceable.length === 0) {
      toast.error(t("timeReports.selectBillable"));
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
    <AppLayout breadcrumb={[{ label: t("timeReports.breadcrumb") }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("timeReports.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("timeReports.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("timeReports.timer")}</CardTitle>
              <CardDescription>{t("timeReports.timerDesc")}</CardDescription>
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
                  {timerRunning ? <Pause className="w-4 h-4 me-1.5" /> : <Play className="w-4 h-4 me-1.5" />}
                  {timerRunning ? t("timeReports.pause") : t("timeReports.start")}
                </Button>
                <Button variant="outline" disabled={timerSeconds < 1} onClick={saveTimerEntry}>
                  {t("timeReports.saveEntry")}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("timeReports.case")}</Label>
                  <Select value={timerCaseId} onValueChange={setTimerCaseId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t("timeReports.selectCase")} />
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
                  <Label>{t("timeReports.description")}</Label>
                  <Input
                    className="mt-1.5"
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder={t("timeReports.workingOn")}
                  />
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>{t("timeReports.case")}</Label>
                  <Select value={manualCaseId} onValueChange={setManualCaseId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t("timeReports.case")} />
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
                  <Label>{t("timeReports.minutes")}</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={1}
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("timeReports.date")}</Label>
                  <Input
                    className="mt-1.5"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={saveManualEntry} disabled={createEntry.isPending}>
                    <Plus className="w-4 h-4 me-1.5" /> {t("timeReports.add")}
                  </Button>
                </div>
                <div className="md:col-span-4">
                  <Label>{t("timeReports.description")}</Label>
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
                {t("timeReports.hourlyRate")}
                {!hasHourlyRate && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              </CardTitle>
              <CardDescription>{t("timeReports.hourlyRateDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasHourlyRate && (
                <p className="text-sm text-amber-800">{t("timeReports.hourlyRateRequired")}</p>
              )}
              <div>
                <Label htmlFor="hourly-rate">{t("timeReports.chfPerHour")}</Label>
                <Input
                  id="hourly-rate"
                  className="mt-1.5"
                  type="number"
                  min={1}
                  step="0.01"
                  value={hourlyRateInput}
                  onChange={(e) => setHourlyRateInput(e.target.value)}
                  placeholder={t("timeReports.ratePlaceholder")}
                />
              </div>
              <Button
                className="w-full"
                variant={hasHourlyRate ? "outline" : "default"}
                disabled={setRate.isPending || !hourlyRateInput}
                onClick={() => setRate.mutate({ hourlyRate: parseFloat(hourlyRateInput) })}
              >
                {hasHourlyRate ? t("timeReports.updateRate") : t("timeReports.saveRate")}
              </Button>
              {hasHourlyRate && (
                <p className="text-xs text-muted-foreground">
                  {t("timeReports.currentRate", { rate: formatCHF(Number(defaultRate)) })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("timeReports.filters")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm">{t("timeReports.dateFrom")}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">{t("timeReports.dateTo")}</Label>
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
              <div className="text-xs text-muted-foreground">{t("timeReports.totalHours")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary?.billableHours?.toFixed(1) ?? "0"}</div>
              <div className="text-xs text-muted-foreground">{t("timeReports.billableHours")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatCHF(summary?.revenue ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{t("timeReports.estRevenue")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{utilizationRate}%</div>
              <div className="text-xs text-muted-foreground">{t("timeReports.utilization")}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="entries">{t("timeReports.entries")}</TabsTrigger>
            <TabsTrigger value="invoice">
              {t("timeReports.createInvoice")}
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
                <Send className="w-4 h-4 me-1.5" /> {t("timeReports.submitSelected")}
              </Button>
              <p className="text-sm text-muted-foreground">{t("timeReports.submitHint")}</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("timeReports.colDate")}</TableHead>
                    <TableHead>{t("timeReports.colCase")}</TableHead>
                    <TableHead>{t("timeReports.colDescription")}</TableHead>
                    <TableHead>{t("timeReports.colDuration")}</TableHead>
                    <TableHead>{t("timeReports.colAmount")}</TableHead>
                    <TableHead>{t("timeReports.colStatus")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t("timeReports.emptyEntries")}
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
                          <Badge variant={statusBadgeVariant(entry.status)}>
                            {t(`common.${entry.status}`, { defaultValue: entry.status })}
                          </Badge>
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
                <CardTitle className="text-base">{t("timeReports.createInvoiceTitle")}</CardTitle>
                <CardDescription>{t("timeReports.createInvoiceDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasHourlyRate && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>{t("timeReports.setRateBeforeInvoice")}</div>
                  </div>
                )}

                {invoiceableEntries.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-8 text-center space-y-2">
                    <p className="font-medium text-foreground">{t("timeReports.noBillable")}</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {t("timeReports.noBillableHint")}
                    </p>
                    <Button variant="outline" className="mt-2" onClick={() => setActiveTab("entries")}>
                      {t("timeReports.goToEntries")}
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
                              aria-label={t("timeReports.selectAllInvoiceable")}
                            />
                          </TableHead>
                          <TableHead>{t("timeReports.colDate")}</TableHead>
                          <TableHead>{t("timeReports.colCase")}</TableHead>
                          <TableHead>{t("timeReports.colDescription")}</TableHead>
                          <TableHead>{t("timeReports.colDuration")}</TableHead>
                          <TableHead>{t("timeReports.colAmount")}</TableHead>
                          <TableHead>{t("timeReports.colStatus")}</TableHead>
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
                              <Badge variant={statusBadgeVariant(entry.status)}>
                                {t(`common.${entry.status}`, { defaultValue: entry.status })}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {selectedInvoiceable.length === 1
                    ? t("timeReports.selectedOne", { count: selectedInvoiceable.length })
                    : t("timeReports.selectedMany", { count: selectedInvoiceable.length })}
                  {selectedInvoiceable.length > 0
                    ? ` · ${formatCHF(selectedTotal)} ${t("timeReports.exclVat")}`
                    : ""}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="invoice-client">{t("timeReports.client")}</Label>
                    <Select value={invoiceClientId} onValueChange={setInvoiceClientId}>
                      <SelectTrigger id="invoice-client" className="mt-1.5">
                        <SelectValue placeholder={t("timeReports.selectClient")} />
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
                    <Label htmlFor="invoice-due">{t("timeReports.dueDate")}</Label>
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
                  {createInvoice.isPending ? t("timeReports.creating") : t("timeReports.createDraftInvoice")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
