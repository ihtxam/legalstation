import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const statusStyles: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  closed: "bg-slate-100 text-slate-600 border border-slate-200",
  archived: "bg-slate-50 text-slate-500 border border-slate-200",
  draft: "bg-slate-100 text-slate-600 border border-slate-200",
  sent: "bg-blue-50 text-blue-700 border border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  overdue: "bg-red-50 text-red-700 border border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
  invited: "bg-blue-50 text-blue-700 border border-blue-200",
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border border-slate-200",
  internal: "bg-purple-50 text-purple-700 border border-purple-200",
  shared: "bg-teal-50 text-teal-700 border border-teal-200",
  submitted: "bg-blue-50 text-blue-700 border border-blue-200",
  billed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const style = statusStyles[status] ?? "bg-slate-100 text-slate-600 border border-slate-200";
  const label = t(`common.${status}`, { defaultValue: status });
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", style, className)}>
      {label}
    </span>
  );
}
