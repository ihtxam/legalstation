import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const statusStyles: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  pending: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  closed: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:border-white/15",
  archived: "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-white/5 dark:text-zinc-400 dark:border-white/10",
  draft: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:border-white/15",
  sent: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  overdue: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/10 dark:text-zinc-400 dark:border-white/15",
  invited: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  inactive: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/10 dark:text-zinc-400 dark:border-white/15",
  internal: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  shared: "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  submitted: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  billed: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  fulfilled: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const style =
    statusStyles[status] ??
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-zinc-300 dark:border-white/15";
  const label = t(`common.${status}`, { defaultValue: status });
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", style, className)}>
      {label}
    </span>
  );
}
