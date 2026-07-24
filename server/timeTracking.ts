/** Pure helpers for time entry billing. */

export type TimeEntryStatus = "draft" | "submitted" | "billed";

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function computeTimeEntryAmount(
  durationMinutes: number,
  hourlyRate: number
): number {
  const hours = minutesToHours(durationMinutes);
  return Math.round(hours * hourlyRate * 100) / 100;
}

export function canTransitionTimeEntryStatus(
  from: TimeEntryStatus,
  to: TimeEntryStatus
): boolean {
  const allowed: Record<TimeEntryStatus, TimeEntryStatus[]> = {
    draft: ["submitted"],
    submitted: ["draft", "billed"],
    billed: [],
  };
  return allowed[from].includes(to);
}

export function summarizeTimeEntries(
  entries: Array<{
    durationMinutes: number;
    billable: boolean;
    hourlyRate?: number | null;
    status: TimeEntryStatus;
  }>,
  defaultRate = 0
): {
  totalMinutes: number;
  billableMinutes: number;
  revenue: number;
  draftCount: number;
  submittedCount: number;
  billedCount: number;
} {
  let totalMinutes = 0;
  let billableMinutes = 0;
  let revenue = 0;
  let draftCount = 0;
  let submittedCount = 0;
  let billedCount = 0;

  for (const e of entries) {
    totalMinutes += e.durationMinutes;
    if (e.billable) {
      billableMinutes += e.durationMinutes;
      const rate = e.hourlyRate != null ? Number(e.hourlyRate) : defaultRate;
      revenue += computeTimeEntryAmount(e.durationMinutes, rate);
    }
    if (e.status === "draft") draftCount += 1;
    else if (e.status === "submitted") submittedCount += 1;
    else if (e.status === "billed") billedCount += 1;
  }

  return {
    totalMinutes,
    billableMinutes,
    revenue: Math.round(revenue * 100) / 100,
    draftCount,
    submittedCount,
    billedCount,
  };
}
