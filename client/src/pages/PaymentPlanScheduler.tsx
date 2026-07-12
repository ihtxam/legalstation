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

interface Installment {
  dueDate: string;
  percentage: number;
  amount: number;
}

export default function PaymentPlanScheduler({ invoiceId, totalAmount }: { invoiceId: number; totalAmount: number }) {
  const { user } = useAuth();
  const [scheduleType, setScheduleType] = useState<"monthly" | "custom">("monthly");
  const [monthCount, setMonthCount] = useState("3");
  const [installments, setInstallments] = useState<Installment[]>([]);

  const createPaymentPlanMutation = trpc.paymentPlans.create.useMutation({
    onSuccess: () => {
      toast.success("Payment plan created");
      setInstallments([]);
    },
    onError: (err) => toast.error(err.message),
  });

  // Generate monthly installments
  const generateMonthlyInstallments = () => {
    const months = parseInt(monthCount);
    const amountPerMonth = totalAmount / months;
    const newInstallments: Installment[] = [];

    for (let i = 0; i < months; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      newInstallments.push({
        dueDate: dueDate.toISOString().split("T")[0],
        percentage: 100 / months,
        amount: amountPerMonth,
      });
    }

    setInstallments(newInstallments);
  };

  // Add custom installment
  const addCustomInstallment = () => {
    const newInstallment: Installment = {
      dueDate: new Date().toISOString().split("T")[0],
      percentage: 0,
      amount: 0,
    };
    setInstallments([...installments, newInstallment]);
  };

  // Update installment
  const updateInstallment = (index: number, field: keyof Installment, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  // Calculate total percentage
  const totalPercentage = installments.reduce((sum, inst) => sum + inst.percentage, 0);

  // Create payment plan
  const handleCreatePlan = () => {
    if (installments.length === 0) {
      toast.error("Add at least one installment");
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error(`Installments must total 100% (currently ${totalPercentage.toFixed(1)}%)`);
      return;
    }

    const intervalDays = installments.length > 1
      ? Math.floor((new Date(installments[1].dueDate).getTime() - new Date(installments[0].dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    createPaymentPlanMutation.mutate({
      invoiceId,
      name: `${monthCount}-Month Payment Plan`,
      installmentCount: installments.length,
      intervalDays,
      installments: installments.map((inst, idx) => ({
        installmentNumber: idx + 1,
        amount: inst.amount,
        daysFromNow: Math.floor((new Date(inst.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan</CardTitle>
        <CardDescription>Define custom payment intervals for this invoice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule Type Selection */}
        <div className="space-y-3">
          <Label>Schedule Type</Label>
          <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly Installments</SelectItem>
              <SelectItem value="custom">Custom Schedule</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Monthly Setup */}
        {scheduleType === "monthly" && (
          <div className="space-y-3">
            <Label htmlFor="monthCount">Number of Months</Label>
            <div className="flex gap-2">
              <Input
                id="monthCount"
                type="number"
                min="1"
                max="12"
                value={monthCount}
                onChange={(e) => setMonthCount(e.target.value)}
              />
              <Button onClick={generateMonthlyInstallments}>Generate</Button>
            </div>
          </div>
        )}

        {/* Custom Setup */}
        {scheduleType === "custom" && (
          <Button onClick={addCustomInstallment} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Installment
          </Button>
        )}

        {/* Installments Table */}
        {installments.length > 0 && (
          <div className="space-y-3">
            <Label>Installments (Total: {totalPercentage.toFixed(1)}%)</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Amount (CHF)</TableHead>
                    <TableHead className="w-10">Action</TableHead>
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

        {/* Create Button */}
        {installments.length > 0 && (
          <Button
            onClick={handleCreatePlan}
            disabled={createPaymentPlanMutation.isPending || Math.abs(totalPercentage - 100) > 0.01}
            className="w-full"
          >
            {createPaymentPlanMutation.isPending ? "Creating..." : "Create Payment Plan"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
