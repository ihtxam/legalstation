import { and, eq, isNull, lte, inArray } from "drizzle-orm";
import {
  paymentInstallments,
  paymentPlans,
} from "../drizzle/schema";
import {
  getDb,
  getInvoiceByIdOnly,
  getNextInvoiceNumber,
  createInvoice,
  createInvoiceItem,
} from "./db";

export function isInstallmentDue(
  dueDate: Date,
  now: Date = new Date()
): boolean {
  return dueDate.getTime() <= now.getTime();
}

export function computeInstallmentInvoiceAmounts(args: {
  installmentAmount: number;
  parentVatRate: number;
}): { subtotal: number; vatAmount: number; total: number } {
  const total = Math.round(args.installmentAmount * 100) / 100;
  const vatRate = args.parentVatRate;
  // Treat installment amount as the gross (VAT-inclusive) total to match schedule UI
  const subtotal =
    vatRate > 0
      ? Math.round((total / (1 + vatRate / 100)) * 100) / 100
      : total;
  const vatAmount = Math.round((total - subtotal) * 100) / 100;
  return { subtotal, vatAmount, total };
}

/**
 * Create a child invoice for a single installment from its parent (template) invoice.
 */
export async function generateInvoiceForInstallment(
  installmentId: number,
  createdByUserId: number
): Promise<{ invoiceId: number; alreadyGenerated: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);
  if (!installment) throw new Error("Installment not found");

  if (installment.generatedInvoiceId) {
    return { invoiceId: installment.generatedInvoiceId, alreadyGenerated: true };
  }

  const [plan] = await db
    .select()
    .from(paymentPlans)
    .where(eq(paymentPlans.id, installment.paymentPlanId))
    .limit(1);
  if (!plan) throw new Error("Payment plan not found");

  const parent = await getInvoiceByIdOnly(plan.invoiceId);
  if (!parent) throw new Error("Parent invoice not found");

  const amount = parseFloat(String(installment.amount));
  const vatRate = parseFloat(String(parent.vatRate));
  const { subtotal, vatAmount, total } = computeInstallmentInvoiceAmounts({
    installmentAmount: amount,
    parentVatRate: vatRate,
  });

  const invoiceNumber = await getNextInvoiceNumber(parent.firmId);
  const result = await createInvoice({
    firmId: parent.firmId,
    caseId: parent.caseId,
    clientId: parent.clientId,
    invoiceNumber,
    status: "sent",
    issueDate: new Date(),
    dueDate: new Date(installment.dueDate),
    subtotal: subtotal.toFixed(2),
    vatRate: vatRate.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
    total: total.toFixed(2),
    currency: parent.currency || "CHF",
    notes: `Installment ${installment.installmentNumber}/${plan.installmentCount} of plan "${plan.name}" (parent ${parent.invoiceNumber})`,
    createdByUserId,
  });

  const invoiceId = Number((result as { insertId?: number }).insertId);
  if (!invoiceId) throw new Error("Failed to create installment invoice");

  await createInvoiceItem({
    invoiceId,
    description: `${plan.name} — installment ${installment.installmentNumber}`,
    billingType: "flat_fee",
    quantity: "1.00",
    unitPrice: subtotal.toFixed(2),
    amount: subtotal.toFixed(2),
    sortOrder: 0,
  });

  await db
    .update(paymentInstallments)
    .set({ generatedInvoiceId: invoiceId })
    .where(eq(paymentInstallments.id, installmentId));

  return { invoiceId, alreadyGenerated: false };
}

/**
 * Generate invoices for all due installments on auto-generate plans.
 * Also marks pending past-due installments as overdue.
 */
export async function processDuePaymentPlanInstallments(
  createdByUserId: number,
  now: Date = new Date()
): Promise<{
  generated: number[];
  skipped: number[];
  markedOverdue: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Mark overdue
  const overdueResult = await db
    .update(paymentInstallments)
    .set({ status: "overdue" })
    .where(
      and(
        eq(paymentInstallments.status, "pending"),
        lte(paymentInstallments.dueDate, now)
      )
    );
  const markedOverdue = Number((overdueResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);

  const autoPlans = await db
    .select()
    .from(paymentPlans)
    .where(eq(paymentPlans.autoGenerateInvoices, true));

  if (!autoPlans.length) {
    return { generated: [], skipped: [], markedOverdue };
  }

  const planIds = autoPlans.map((p) => p.id);
  const dueInstallments = await db
    .select()
    .from(paymentInstallments)
    .where(
      and(
        inArray(paymentInstallments.paymentPlanId, planIds),
        isNull(paymentInstallments.generatedInvoiceId),
        lte(paymentInstallments.dueDate, now),
        inArray(paymentInstallments.status, ["pending", "overdue"])
      )
    );

  const generated: number[] = [];
  const skipped: number[] = [];

  for (const inst of dueInstallments) {
    try {
      const result = await generateInvoiceForInstallment(inst.id, createdByUserId);
      if (result.alreadyGenerated) skipped.push(inst.id);
      else generated.push(result.invoiceId);
    } catch (err) {
      console.error(`[PaymentPlans] Failed to generate for installment ${inst.id}:`, err);
      skipped.push(inst.id);
    }
  }

  return { generated, skipped, markedOverdue };
}
