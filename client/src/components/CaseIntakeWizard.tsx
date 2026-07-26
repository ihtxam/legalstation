import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { CASE_TYPE_LABELS } from "@shared/types";
import { Upload } from "lucide-react";

type IntakeForm = {
  title: string;
  type: keyof typeof CASE_TYPE_LABELS;
  privacyLevel: "private" | "sensitive" | "standard";
  relatedLawArea: string;
  desiredOutcome: string;
  happenedAt: string;
  howItHappened: string;
  involvement: string;
  additionalNotes: string;
};

const empty: IntakeForm = {
  title: "",
  type: "other",
  privacyLevel: "standard",
  relatedLawArea: "",
  desiredOutcome: "",
  happenedAt: "",
  howItHappened: "",
  involvement: "",
  additionalNotes: "",
};

export function CaseIntakeWizard({
  open,
  onOpenChange,
  onCreated,
  allowedCaseTypes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (caseId: number) => void;
  allowedCaseTypes?: string[] | null;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IntakeForm>(empty);
  const [files, setFiles] = useState<File[]>([]);
  const createIntake = trpc.clientPackages.createCaseIntake.useMutation();
  const registerDocument = trpc.documents.register.useMutation();

  const types = Object.entries(CASE_TYPE_LABELS).filter(
    ([value]) => !allowedCaseTypes?.length || allowedCaseTypes.includes(value)
  );

  const canNext =
    step === 0
      ? form.title.trim().length >= 3 && form.relatedLawArea.trim().length >= 1
      : step === 1
        ? form.happenedAt.trim() && form.howItHappened.trim().length >= 10
        : form.desiredOutcome.trim().length >= 10 && form.involvement.trim().length >= 5;

  const reset = () => {
    setStep(0);
    setForm(empty);
    setFiles([]);
  };

  const submit = async () => {
    try {
      const result = await createIntake.mutateAsync({
        title: form.title.trim(),
        type: form.type,
        privacyLevel: form.privacyLevel,
        relatedLawArea: form.relatedLawArea.trim(),
        desiredOutcome: form.desiredOutcome.trim(),
        happenedAt: form.happenedAt.trim(),
        howItHappened: form.howItHappened.trim(),
        involvement: form.involvement.trim(),
        additionalNotes: form.additionalNotes.trim() || undefined,
      });
      for (const file of files) {
        const { postFileUpload } = await import("@/lib/uploadHelpers");
        const { fileKey, fileUrl } = await postFileUpload(file);
        await registerDocument.mutateAsync({
          caseId: result.case.id,
          name: file.name,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          fileKey,
          fileUrl,
          description: "Evidence attached with case intake",
          visibility: "shared",
        });
      }
      toast.success(t("packages.intakeSubmitted"));
      onCreated(result.case.id);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || t("packages.intakeFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("packages.intakeTitle")} · {t("packages.step", { n: step + 1, total: 3 })}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">{t("packages.intakeStep1Hint")}</p>
            <div>
              <Label>{t("packages.issueTitle")}</Label>
              <Input
                className="mt-1.5"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.lawArea")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    type: v as keyof typeof CASE_TYPE_LABELS,
                    relatedLawArea: CASE_TYPE_LABELS[v as keyof typeof CASE_TYPE_LABELS] || v,
                  }));
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("packages.privacyLevel")}</Label>
              <Select
                value={form.privacyLevel}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    privacyLevel: v as IntakeForm["privacyLevel"],
                  }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t("packages.privacyStandard")}</SelectItem>
                  <SelectItem value="private">{t("packages.privacyPrivate")}</SelectItem>
                  <SelectItem value="sensitive">{t("packages.privacySensitive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">{t("packages.intakeStep2Hint")}</p>
            <div>
              <Label>{t("packages.whenHappened")}</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. March 2026 / 12.03.2026"
                value={form.happenedAt}
                onChange={(e) => setForm((f) => ({ ...f, happenedAt: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.howHappened")}</Label>
              <Textarea
                className="mt-1.5 min-h-28"
                value={form.howItHappened}
                onChange={(e) => setForm((f) => ({ ...f, howItHappened: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.attachEvidence")}</Label>
              <input
                type="file"
                multiple
                className="mt-1.5 block w-full text-sm"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("portal.filesSelected", { count: files.length })}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">{t("packages.intakeStep3Hint")}</p>
            <div>
              <Label>{t("packages.desiredOutcome")}</Label>
              <Textarea
                className="mt-1.5 min-h-24"
                value={form.desiredOutcome}
                onChange={(e) => setForm((f) => ({ ...f, desiredOutcome: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.involvement")}</Label>
              <Textarea
                className="mt-1.5 min-h-24"
                value={form.involvement}
                onChange={(e) => setForm((f) => ({ ...f, involvement: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.additionalNotes")}</Label>
              <Textarea
                className="mt-1.5"
                value={form.additionalNotes}
                onChange={(e) => setForm((f) => ({ ...f, additionalNotes: e.target.value }))}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              {t("common.back")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          )}
          {step < 2 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              {t("common.next")}
            </Button>
          ) : (
            <Button
              disabled={!canNext || createIntake.isPending}
              onClick={() => void submit()}
            >
              <Upload className="w-4 h-4 me-1.5" />
              {createIntake.isPending ? t("common.loading") : t("packages.submitIssue")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
