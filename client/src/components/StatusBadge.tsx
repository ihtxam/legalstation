import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  closed: { label: "Closed", className: "bg-slate-100 text-slate-600 border border-slate-200" },
  archived: { label: "Archived", className: "bg-slate-50 text-slate-500 border border-slate-200" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600 border border-slate-200" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500 border border-slate-200" },
  invited: { label: "Invited", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-500 border border-slate-200" },
  internal: { label: "Internal", className: "bg-purple-50 text-purple-700 border border-purple-200" },
  shared: { label: "Shared", className: "bg-teal-50 text-teal-700 border border-teal-200" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-slate-100 text-slate-600 border border-slate-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
