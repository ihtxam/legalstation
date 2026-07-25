import { useTranslation } from "react-i18next";
import {
  FIRM_DISPLAY_ROLES,
  ROLE_CAPABILITY_MATRIX,
  type CapabilityAccess,
  type FirmDisplayRole,
} from "@shared/roles";
import { Check, Eye, Minus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

function AccessCell({ access }: { access: CapabilityAccess }) {
  const { t } = useTranslation();
  if (access === "full") {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-emerald-700" title={t("roles.access.full")}>
        <Check className="w-4 h-4" aria-hidden />
        <span className="sr-only">{t("roles.access.full")}</span>
      </span>
    );
  }
  if (access === "own") {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-[var(--color-navy)]" title={t("roles.access.own")}>
        <UserRound className="w-4 h-4" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide">{t("roles.access.ownShort")}</span>
      </span>
    );
  }
  if (access === "view") {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-amber-700" title={t("roles.access.view")}>
        <Eye className="w-4 h-4" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide">{t("roles.access.viewShort")}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-muted-foreground/50" title={t("roles.access.none")}>
      <Minus className="w-4 h-4" aria-hidden />
      <span className="sr-only">{t("roles.access.none")}</span>
    </span>
  );
}

function roleLabelKey(role: FirmDisplayRole): string {
  return `roles.${role}`;
}

/**
 * Authorization matrix: functions × firm roles (admin / subadmin / lawyer / assistant / client).
 */
export default function RolePermissionsTable() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">{t("roles.matrixTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("roles.matrixHint")}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-start px-4 py-3 font-semibold text-muted-foreground sticky start-0 bg-muted/40 z-10">
                {t("roles.function")}
              </th>
              {FIRM_DISPLAY_ROLES.map((role) => (
                <th key={role} className="px-3 py-3 font-semibold text-center text-foreground whitespace-nowrap">
                  {t(roleLabelKey(role))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROLE_CAPABILITY_MATRIX.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 sticky start-0 bg-card z-10">
                  <div className="font-medium text-foreground">{t(row.labelKey)}</div>
                  {row.noteKey && (
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{t(row.noteKey)}</p>
                  )}
                </td>
                {FIRM_DISPLAY_ROLES.map((role) => (
                  <td key={role} className="px-3 py-3 text-center">
                    <AccessCell access={row.access[role]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-700" /> {t("roles.access.full")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="w-3.5 h-3.5 text-[var(--color-navy)]" /> {t("roles.access.own")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-amber-700" /> {t("roles.access.view")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="w-3.5 h-3.5" /> {t("roles.access.none")}
        </span>
      </div>

      <div className={cn("rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground")}>
        <p className="font-medium text-foreground mb-1">{t("roles.howToCreateTitle")}</p>
        <p>{t("roles.howToCreateBody")}</p>
      </div>
    </div>
  );
}
