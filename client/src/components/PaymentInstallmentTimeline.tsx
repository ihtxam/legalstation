import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Installment {
  id: number;
  installmentNumber: number;
  amount: number;
  daysFromNow?: number;
  status: "pending" | "paid" | "overdue" | "failed";
  dueDate: Date;
  generatedInvoiceId?: number | null;
}

interface PaymentInstallmentTimelineProps {
  invoiceNumber: string;
  installments: Installment[];
  totalAmount: number;
  currency?: string;
  onGenerateInvoice?: (installmentId: number) => void;
  generatingId?: number | null;
}

export function PaymentInstallmentTimeline({
  invoiceNumber,
  installments,
  totalAmount,
  currency = "CHF",
  onGenerateInvoice,
  generatingId,
}: PaymentInstallmentTimelineProps) {
  if (!installments || installments.length === 0) {
    return null;
  }

  // Sort by due date
  const sorted = [...installments].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Calculate progress
  const paidAmount = sorted
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const progressPercent = (paidAmount / totalAmount) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Plan — {invoiceNumber}</CardTitle>
        <CardDescription>
          {sorted.filter((i) => i.status === "paid").length} of {sorted.length} installments paid
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {sorted.map((installment, index) => {
            const isPaid = installment.status === "paid";
            const isOverdue = installment.status === "overdue";
            const isPending = installment.status === "pending";

            return (
              <div key={installment.id} className="flex gap-4">
                {/* Timeline Dot */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isPaid
                        ? "bg-emerald-100"
                        : isOverdue
                          ? "bg-red-100"
                          : "bg-slate-100"
                    }`}
                  >
                    {isPaid ? (
                      <Check className="w-5 h-5 text-emerald-600" />
                    ) : isOverdue ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  {index < sorted.length - 1 && (
                    <div className="w-0.5 h-12 bg-slate-200" />
                  )}
                </div>

                {/* Installment Details */}
                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        Installment {installment.installmentNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Due {new Date(installment.dueDate).toLocaleDateString("de-CH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(installment.amount, currency)}
                      </div>
                      <Badge
                        variant={
                          isPaid
                            ? "default"
                            : isOverdue
                              ? "destructive"
                              : "secondary"
                        }
                        className="mt-1"
                      >
                        {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
                      </Badge>
                    </div>
                  </div>

                  {/* Status Message */}
                  {isPending && (installment.daysFromNow ?? 0) > 0 && (
                    <div className="text-xs text-slate-500 mt-2">
                      Due in {installment.daysFromNow} day{installment.daysFromNow !== 1 ? "s" : ""}
                    </div>
                  )}
                  {isOverdue && installment.daysFromNow != null && (
                    <div className="text-xs text-red-600 mt-2 font-medium">
                      Overdue by {Math.abs(installment.daysFromNow)} day{Math.abs(installment.daysFromNow) !== 1 ? "s" : ""}
                    </div>
                  )}
                  {installment.generatedInvoiceId ? (
                    <div className="text-xs text-muted-foreground mt-2">
                      Invoice #{installment.generatedInvoiceId} generated
                    </div>
                  ) : onGenerateInvoice && !isPaid ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--color-navy)] underline mt-2 disabled:opacity-50"
                      disabled={generatingId === installment.id}
                      onClick={() => onGenerateInvoice(installment.id)}
                    >
                      {generatingId === installment.id ? "Generating…" : "Generate invoice now"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border-t pt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(paidAmount, currency)}
            </div>
            <div className="text-xs text-muted-foreground">Paid</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-600">
              {formatCurrency(
                sorted
                  .filter((i) => i.status === "pending")
                  .reduce((sum, i) => sum + i.amount, 0),
                currency
              )}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                sorted
                  .filter((i) => i.status === "overdue")
                  .reduce((sum, i) => sum + i.amount, 0),
                currency
              )}
            </div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
