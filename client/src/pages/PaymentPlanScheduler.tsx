import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Installment {
  dueDate: string;
  percentage: number;
  amount: number;
}

export default function PaymentPlanScheduler({
  invoiceId,
  totalAmount,
  onCreated,
}: {
  invoiceId: number;
  totalAmount: number;
  onCreated?: () => void;
}) {
  const { t } = useTranslation();
  useAuth();
  const [scheduleType, setScheduleType] = useState<"monthly" | "custom">("monthly");
  const [monthCount, setMonthCount] = useState("3");
  const [installments, setInstallments] = useState<Installment[]>([]);
  /** Send first invoice now; generate & email later installments when due (e.g. +30 days). */
  const [sendAndSchedule, setSendAndSchedule] = useState(true);

  const createPaymentPlanMutation = trpc.paymentPlans.create.useMutation({
    onSuccess: (data) => {
      const genCount = data.generatedInvoiceIds?.length ?? 0;
      const emailed = data.emailedInvoiceIds?.length ?? 0;
      if (genCount > 0 && emailed > 0) {
        toast.success(t("paymentPlan.createdSentFirst", { count: genCount, emailed }));
      } else if (genCount > 0) {
        toast.success(t("paymentPlan.createdWithInvoices", { count: genCount }));
      } else {
        toast.success(t("paymentPlan.created"));
      }
      setInstallments([]);
      onCreated?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateMonthlyInstallments = () => {
    const months = parseInt(monthCount);
    const amountPerMonth = totalAmount / months;
    const newInstallments: Installment[] = [];

    for (let i = 0; i < months; i++) {
      const dueDate = new Date();
      // First installment due today; each next installment +30 days
      dueDate.setDate(dueDate.getDate() + i * 30);
      newInstallments.push({
        dueDate: dueDate.toISOString().split("T")[0],
        percentage: 100 / months,
        amount: amountPerMonth,
      });
    }

    setInstallments(newInstallments);
  };

  const addCustomInstallment = () => {
    const newInstallment: Installment = {
      dueDate: new Date().toISOString().split("T")[0],
      percentage: 0,
      amount: 0,
    };
    setInstallments([...installments, newInstallment]);
  };

  const updateInstallment = (index: number, field: keyof Installment, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const totalPercentage = installments.reduce((sum, inst) => sum + inst.percentage, 0);

  const handleCreatePlan = () => {
    if (installments.length === 0) {
      toast.error(t("paymentPlan.needInstallment"));
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error(t("paymentPlan.mustTotal100", { total: totalPercentage.toFixed(1) }));
      return;
    }

    const intervalDays =
      scheduleType === "monthly"
        ? 30
        : installments.length > 1
          ? Math.max(
              1,
              Math.floor(
                (new Date(installments[1].dueDate).getTime() -
                  new Date(installments[0].dueDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 30;

    createPaymentPlanMutation.mutate({
      invoiceId,
      name: scheduleType === "monthly"
        ? t("paymentPlan.monthlyName", { count: monthCount })
        : t("paymentPlan.customName"),
      installmentCount: installments.length,
      intervalDays,
      autoGenerateInvoices: sendAndSchedule,
      autoSendInvoices: sendAndSchedule,
      sendFirstNow: sendAndSchedule,
      generateDueNow: sendAndSchedule,
      installments: installments.map((inst, idx) => ({
        installmentNumber: idx + 1,
        amount: inst.amount,
        daysFromNow: Math.max(
          0,
          Math.floor((new Date(inst.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        ),
      })),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("paymentPlan.title")}</CardTitle>
        <CardDescription>{t("paymentPlan.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>{t("paymentPlan.scheduleType")}</Label>
          <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{t("paymentPlan.monthly")}</SelectItem>
              <SelectItem value="custom">{t("paymentPlan.custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scheduleType === "monthly" && (
          <div className="space-y-3">
            <Label htmlFor="monthCount">{t("paymentPlan.numberOfMonths")}</Label>
            <div className="flex gap-2">
              <Input
                id="monthCount"
                type="number"
                min="1"
                max="12"
                value={monthCount}
                onChange={(e) => setMonthCount(e.target.value)}
              />
              <Button onClick={generateMonthlyInstallments}>{t("paymentPlan.generate")}</Button>
            </div>
          </div>
        )}

        {scheduleType === "custom" && (
          <Button onClick={addCustomInstallment} variant="outline">
            <Plus className="w-4 h-4 me-2" />
            {t("paymentPlan.addInstallment")}
          </Button>
        )}

        {installments.length > 0 && (
          <div className="space-y-3">
            <Label>{t("paymentPlan.installmentsTotal", { total: totalPercentage.toFixed(1) })}</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("paymentPlan.dueDate")}</TableHead>
                    <TableHead>{t("paymentPlan.percentage")}</TableHead>
                    <TableHead>{t("paymentPlan.amountChf")}</TableHead>
                    <TableHead className="w-10">{t("paymentPlan.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((inst, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => updateInstallment(idx, "dueDate", e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={inst.percentage}
                          onChange={(e) => updateInstallment(idx, "percentage", parseFloat(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={inst.amount}
                          onChange={(e) => updateInstallment(idx, "amount", parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInstallment(idx)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              id="sendAndSchedule"
              type="checkbox"
              checked={sendAndSchedule}
              onChange={(e) => setSendAndSchedule(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="sendAndSchedule">{t("paymentPlan.sendAndSchedule")}</Label>
          </div>
          <p className="text-xs text-muted-foreground ms-6">{t("paymentPlan.sendAndScheduleHint")}</p>
        </div>

        {installments.length > 0 && (
          <Button
            onClick={handleCreatePlan}
            disabled={createPaymentPlanMutation.isPending || Math.abs(totalPercentage - 100) > 0.01}
            className="w-full"
          >
            {createPaymentPlanMutation.isPending ? t("paymentPlan.creating") : t("paymentPlan.create")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
