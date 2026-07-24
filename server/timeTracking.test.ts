import { describe, expect, it } from "vitest";
import {
  canTransitionTimeEntryStatus,
  computeTimeEntryAmount,
  minutesToHours,
  summarizeTimeEntries,
} from "./timeTracking";

describe("time tracking helpers", () => {
  it("converts minutes to hours", () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(45)).toBe(0.75);
  });

  it("computes billable amount from duration and rate", () => {
    expect(computeTimeEntryAmount(60, 350)).toBe(350);
    expect(computeTimeEntryAmount(90, 200)).toBe(300);
  });

  it("enforces draft → submitted → billed transitions", () => {
    expect(canTransitionTimeEntryStatus("draft", "submitted")).toBe(true);
    expect(canTransitionTimeEntryStatus("submitted", "billed")).toBe(true);
    expect(canTransitionTimeEntryStatus("submitted", "draft")).toBe(true);
    expect(canTransitionTimeEntryStatus("billed", "draft")).toBe(false);
    expect(canTransitionTimeEntryStatus("draft", "billed")).toBe(false);
  });

  it("summarizes entries for reports", () => {
    const summary = summarizeTimeEntries([
      { durationMinutes: 60, billable: true, hourlyRate: 300, status: "submitted" },
      { durationMinutes: 30, billable: false, hourlyRate: 300, status: "draft" },
      { durationMinutes: 120, billable: true, hourlyRate: 250, status: "billed" },
    ]);
    expect(summary.totalMinutes).toBe(210);
    expect(summary.billableMinutes).toBe(180);
    expect(summary.revenue).toBe(800);
    expect(summary.draftCount).toBe(1);
    expect(summary.submittedCount).toBe(1);
    expect(summary.billedCount).toBe(1);
  });
});
