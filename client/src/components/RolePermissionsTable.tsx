import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CAPABILITY_ACCESS_LEVELS,
  FIRM_DISPLAY_ROLES,
  ROLE_CAPABILITY_MATRIX,
  type CapabilityAccess,
  type FirmDisplayRole,
  type RoleCapabilityId,
  type RoleCapabilityRow,
} from "@shared/roles";
import { Check, Eye, Minus, RotateCcw, Save, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function AccessIcon({ access }: { access: CapabilityAccess }) {
  const { t } = useTranslation();
  if (access === "full") {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300" title={t("roles.access.full")}>
        <Check className="w-4 h-4" aria-hidden />
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
      <span className="inline-flex items-center justify-center gap-1 text-amber-700 dark:text-amber-300" title={t("roles.access.view")}>
        <Eye className="w-4 h-4" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide">{t("roles.access.viewShort")}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-muted-foreground/50" title={t("roles.access.none")}>
      <Minus className="w-4 h-4" aria-hidden />
    </span>
  );
}

function isLocked(capabilityId: RoleCapabilityId, role: FirmDisplayRole) {
  return capabilityId === "firmSettings" && role === "admin";
}

function cloneMatrix(rows: RoleCapabilityRow[]): RoleCapabilityRow[] {
  return rows.map((r) => ({ ...r, access: { ...r.access } }));
}

function matricesEqual(a: RoleCapabilityRow[], b: RoleCapabilityRow[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    for (const role of FIRM_DISPLAY_ROLES) {
      if (a[i].access[role] !== b[i].access[role]) return false;
    }
  }
  return true;
}

function AccessSelect({
  value,
  locked,
  canEdit,
  ariaLabel,
  onChange,
}: {
  value: CapabilityAccess;
  locked: boolean;
  canEdit: boolean;
  ariaLabel: string;
  onChange: (access: CapabilityAccess) => void;
}) {
  const { t } = useTranslation();
  if (!canEdit || locked) {
    return (
      <div className={cn(locked && "opacity-80")} title={locked ? t("roles.adminLocked") : undefined}>
        <AccessIcon access={value} />
      </div>
    );
  }
  return (
    <select
      className="block w-full max-w-[8rem] border border-input rounded-md bg-background px-1.5 py-1.5 text-xs"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as CapabilityAccess)}
    >
      {CAPABILITY_ACCESS_LEVELS.map((level) => (
        <option key={level} value={level}>
          {t(
            `roles.access.${
              level === "own" ? "ownShort" : level === "view" ? "viewShort" : level === "full" ? "full" : "none"
            }`
          )}
        </option>
      ))}
    </select>
  );
}

/**
 * Authorization matrix — editable by firm admins (Settings → Roles).
 * Desktop: full table. Mobile: one role at a time so columns are never off-screen/hidden.
 */
export default function RolePermissionsTable() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.firm.getRoleCapabilities.useQuery();
  const [draft, setDraft] = useState<RoleCapabilityRow[] | null>(null);
  const [mobileRole, setMobileRole] = useState<FirmDisplayRole>("admin");

  useEffect(() => {
    if (data?.matrix) setDraft(cloneMatrix(data.matrix as RoleCapabilityRow[]));
  }, [data?.matrix]);

  const canEdit = Boolean(data?.canEdit);
  const saved = (data?.matrix as RoleCapabilityRow[] | undefined) ?? ROLE_CAPABILITY_MATRIX;
  const matrix = draft ?? saved;
  const dirty = useMemo(() => (draft ? !matricesEqual(draft, saved) : false), [draft, saved]);

  const saveMutation = trpc.firm.updateRoleCapabilities.useMutation({
    onSuccess: async (res) => {
      setDraft(cloneMatrix(res.matrix as RoleCapabilityRow[]));
      await utils.firm.getRoleCapabilities.invalidate();
      await utils.firm.myFirm.invalidate();
      toast.success(t("roles.saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.firm.resetRoleCapabilities.useMutation({
    onSuccess: async (res) => {
      setDraft(cloneMatrix(res.matrix as RoleCapabilityRow[]));
      await utils.firm.getRoleCapabilities.invalidate();
      await utils.firm.myFirm.invalidate();
      toast.success(t("roles.resetDone"));
    },
    onError: (e) => toast.error(e.message),
  });

  const setAccess = (capabilityId: RoleCapabilityId, role: FirmDisplayRole, access: CapabilityAccess) => {
    if (!canEdit || isLocked(capabilityId, role)) return;
    setDraft((prev) => {
      const base = cloneMatrix(prev ?? saved);
      return base.map((row) =>
        row.id === capabilityId ? { ...row, access: { ...row.access, [role]: access } } : row
      );
    });
  };

  const onSave = () => {
    if (!draft) return;
    saveMutation.mutate({
      matrix: draft.map((row) => ({ id: row.id, access: row.access })),
    });
  };

  if (isLoading && !draft) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{t("roles.matrixTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {canEdit ? t("roles.matrixHintEditable") : t("roles.matrixHint")}
          </p>
          {data?.hasOverrides && (
            <p className="text-xs text-[var(--color-navy)] mt-1 font-medium">{t("roles.customizedBadge")}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetMutation.isPending || (!data?.hasOverrides && !dirty)}
              onClick={() => {
                if (confirm(t("roles.resetConfirm"))) resetMutation.mutate();
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 me-1.5" />
              {t("roles.resetDefaults")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[var(--color-navy)] text-white"
              disabled={!dirty || saveMutation.isPending}
              onClick={onSave}
            >
              <Save className="w-3.5 h-3.5 me-1.5" />
              {saveMutation.isPending ? t("common.loading") : t("roles.saveChanges")}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile: one role at a time — nothing scrolled off-screen */}
      <div className="md:hidden space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t("roles.mobileRoleLabel")}</p>
          <div className="flex flex-wrap gap-1.5">
            {FIRM_DISPLAY_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setMobileRole(role)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  mobileRole === role
                    ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                {t(`roles.${role}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {matrix.map((row) => {
            const locked = isLocked(row.id, mobileRole);
            const value = row.access[mobileRole];
            return (
              <div key={row.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground text-sm">{t(row.labelKey)}</div>
                  {row.noteKey && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t(row.noteKey)}</p>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  <AccessSelect
                    value={value}
                    locked={locked}
                    canEdit={canEdit}
                    ariaLabel={`${t(row.labelKey)} — ${t(`roles.${mobileRole}`)}`}
                    onChange={(access) => setAccess(row.id, mobileRole, access)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop / tablet: full matrix */}
      <div className="hidden md:block space-y-2">
        <p className="text-xs text-muted-foreground lg:hidden">{t("roles.scrollHint")}</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground sticky start-0 bg-muted z-10">
                  {t("roles.function")}
                </th>
                {FIRM_DISPLAY_ROLES.map((role) => (
                  <th key={role} className="px-3 py-3 font-semibold text-center text-foreground whitespace-nowrap">
                    {t(`roles.${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 sticky start-0 bg-card z-10">
                    <div className="font-medium text-foreground">{t(row.labelKey)}</div>
                    {row.noteKey && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{t(row.noteKey)}</p>
                    )}
                  </td>
                  {FIRM_DISPLAY_ROLES.map((role) => {
                    const locked = isLocked(row.id, role);
                    const value = row.access[role];
                    return (
                      <td key={role} className="px-2 py-2 text-center align-middle">
                        <div className="flex justify-center">
                          <AccessSelect
                            value={value}
                            locked={locked}
                            canEdit={canEdit}
                            ariaLabel={`${t(row.labelKey)} — ${t(`roles.${role}`)}`}
                            onChange={(access) => setAccess(row.id, role, access)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" /> {t("roles.access.full")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="w-3.5 h-3.5 text-[var(--color-navy)]" /> {t("roles.access.own")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" /> {t("roles.access.view")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="w-3.5 h-3.5" /> {t("roles.access.none")}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t("roles.howToCreateTitle")}</p>
        <p>{t("roles.howToCreateBody")}</p>
      </div>
    </div>
  );
}
