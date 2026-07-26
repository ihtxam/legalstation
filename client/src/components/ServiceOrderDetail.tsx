import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { postFileUpload } from "@/lib/uploadHelpers";
import { Download, FileUp, Lock, Paperclip } from "lucide-react";

type Props = {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** firm | client — controls available actions */
  mode: "firm" | "client";
  lawyers?: Array<{ id: number; label: string }>;
  onChanged?: () => void;
};

type PendingFile = {
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType?: string | null;
  size: number;
};

export function ServiceOrderDetail({
  orderId,
  open,
  onOpenChange,
  mode,
  lawyers = [],
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [revisionMsg, setRevisionMsg] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lawyerId, setLawyerId] = useState("");

  const detail = trpc.ondemandServices.getOrderDetail.useQuery(
    { orderId: orderId! },
    { enabled: open && orderId != null }
  );

  useEffect(() => {
    if (!open) {
      setDescription("");
      setRevisionMsg("");
      setDeliveryNote("");
      setRemarks("");
      setPendingFiles([]);
      setLawyerId("");
    }
  }, [open, orderId]);

  useEffect(() => {
    if (detail.data?.order.lawyerRemarks) {
      setRemarks(detail.data.order.lawyerRemarks);
    }
  }, [detail.data?.order.lawyerRemarks]);

  const refresh = async () => {
    await detail.refetch();
    onChanged?.();
  };

  const submitIntake = trpc.ondemandServices.submitClientIntake.useMutation({
    onSuccess: async () => {
      toast.success(t("services.intakeSubmitted"));
      setPendingFiles([]);
      setDescription("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const requestRevision = trpc.ondemandServices.requestRevision.useMutation({
    onSuccess: async () => {
      toast.success(t("services.revisionRequested"));
      setRevisionMsg("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const deliverWork = trpc.ondemandServices.deliverWork.useMutation({
    onSuccess: async () => {
      toast.success(t("services.delivered"));
      setPendingFiles([]);
      setDeliveryNote("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const addRemarks = trpc.ondemandServices.addLawyerRemarks.useMutation({
    onSuccess: async () => {
      toast.success(t("services.remarksSaved"));
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const completeOrder = trpc.ondemandServices.completeOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.completed"));
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const acceptOrder = trpc.ondemandServices.acceptOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.accepted"));
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const assignLawyer = trpc.ondemandServices.assignLawyerToOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.lawyerAssigned"));
      setLawyerId("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: PendingFile[] = [];
      for (const file of Array.from(files)) {
        const res = await postFileUpload(file);
        uploaded.push({
          fileName: file.name,
          fileKey: res.fileKey,
          fileUrl: res.fileUrl,
          mimeType: file.type,
          size: file.size,
        });
      }
      setPendingFiles((prev) => [...prev, ...uploaded]);
    } catch (e: any) {
      toast.error(e?.message || t("services.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const order = detail.data?.order;
  const isDoc = order?.fulfillmentType === "document";
  const isConsult = order?.fulfillmentType === "consultation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {order
              ? t("services.orderDetailTitle", { number: order.orderNumber })
              : t("services.orderDetail")}
          </DialogTitle>
        </DialogHeader>

        {detail.isLoading || !order ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {order.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="secondary">
                {isConsult ? t("services.fulfillmentConsultation") : t("services.fulfillmentDocument")}
              </Badge>
              {order.isLocked ? (
                <Badge variant="destructive" className="gap-1">
                  <Lock className="w-3 h-3" />
                  {t("services.locked")}
                </Badge>
              ) : null}
            </div>

            <div>
              <p className="font-medium">
                {(detail.data?.items || []).map((i) => i.serviceName).join(", ")}
              </p>
              <p className="text-muted-foreground">
                {Number(order.subtotal).toFixed(2)} {order.currency}
                {detail.data?.assigneeName
                  ? ` · ${t("services.assignedTo", { name: detail.data.assigneeName })}`
                  : ""}
              </p>
            </div>

            {order.status === "awaiting_intake" && mode === "client" ? (
              <p className="text-muted-foreground rounded-lg border border-border p-3 bg-muted/30">
                {isConsult ? t("services.awaitingIntakeConsultHint") : t("services.awaitingIntakeDocHint")}
              </p>
            ) : null}

            {order.intakeSubmittedAt ? (
              <div className="space-y-1">
                <p className="font-medium">{t("services.clientIntake")}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{order.intakeDescription}</p>
                <p className="text-xs text-muted-foreground">
                  {t("services.intakeImmutable")}
                </p>
              </div>
            ) : null}

            {order.lawyerRemarks ? (
              <div className="space-y-1">
                <p className="font-medium">{t("services.lawyerRemarks")}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{order.lawyerRemarks}</p>
              </div>
            ) : null}

            {(detail.data?.attachments || []).length > 0 ? (
              <div className="space-y-2">
                <p className="font-medium">{t("services.files")}</p>
                {(detail.data?.attachments || []).map((f) => (
                  <a
                    key={f.id}
                    href={f.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:bg-muted/50"
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 truncate">
                      {f.fileName}
                      <span className="text-xs text-muted-foreground ms-1">
                        ({f.kind === "client_source"
                          ? t("services.fileClient")
                          : t("services.fileDelivery", { round: f.round })}
                        )
                      </span>
                    </span>
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            ) : null}

            {(detail.data?.events || []).length > 0 ? (
              <div className="space-y-1">
                <p className="font-medium">{t("services.activity")}</p>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(detail.data?.events || []).map((ev) => (
                    <li key={ev.id} className="text-xs text-muted-foreground border-s-2 border-border ps-2">
                      <span className="font-medium text-foreground capitalize">
                        {ev.type.replace(/_/g, " ")}
                      </span>
                      {ev.body ? ` — ${ev.body}` : ""}
                      <span className="block opacity-70">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Client: submit intake */}
            {mode === "client" && order.canSubmitIntake ? (
              <div className="space-y-3 border-t pt-3">
                <Label>
                  {isConsult ? t("services.consultDetails") : t("services.docDescription")}
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={
                    isConsult
                      ? t("services.consultDetailsPlaceholder")
                      : t("services.docDescriptionPlaceholder")
                  }
                />
                {isDoc ? (
                  <div className="space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      <FileUp className="w-3.5 h-3.5 me-1.5" />
                      {uploading ? t("common.loading") : t("services.uploadDocs")}
                    </Button>
                    {pendingFiles.map((f) => (
                      <p key={f.fileKey} className="text-xs text-muted-foreground">
                        {f.fileName}
                      </p>
                    ))}
                  </div>
                ) : null}
                <Button
                  disabled={
                    description.trim().length < 10 ||
                    submitIntake.isPending ||
                    (isDoc && pendingFiles.length === 0)
                  }
                  onClick={() =>
                    submitIntake.mutate({
                      orderId: order.id,
                      description: description.trim(),
                      attachments: pendingFiles,
                    })
                  }
                >
                  {submitIntake.isPending ? t("common.loading") : t("services.submitIntake")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("services.submitIntakeWarning")}</p>
              </div>
            ) : null}

            {/* Client: request revision */}
            {mode === "client" && order.canRequestRevision ? (
              <div className="space-y-3 border-t pt-3">
                <Label>
                  {t("services.requestRevision")} ({order.revisionsRemaining}{" "}
                  {t("services.remaining")})
                </Label>
                <Textarea
                  value={revisionMsg}
                  onChange={(e) => setRevisionMsg(e.target.value)}
                  rows={3}
                />
                <Button
                  variant="outline"
                  disabled={revisionMsg.trim().length < 5 || requestRevision.isPending}
                  onClick={() =>
                    requestRevision.mutate({
                      orderId: order.id,
                      message: revisionMsg.trim(),
                    })
                  }
                >
                  {requestRevision.isPending ? t("common.loading") : t("services.sendRevision")}
                </Button>
              </div>
            ) : null}

            {mode === "client" && order.isLocked ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                {t("services.lockedHint")}
              </p>
            ) : null}

            {/* Firm: accept / assign */}
            {mode === "firm" && !order.isLocked ? (
              <div className="space-y-3 border-t pt-3">
                {["ready_for_firm", "awaiting_acceptance"].includes(order.status) && !order.caseId ? (
                  <div className="space-y-2">
                    <Label>{t("services.assignLawyerOptional")}</Label>
                    <Select
                      value={lawyerId || "none"}
                      onValueChange={(v) => setLawyerId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("services.assignLater")}</SelectItem>
                        {lawyers.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={acceptOrder.isPending}
                      onClick={() =>
                        acceptOrder.mutate({
                          orderId: order.id,
                          lawyerUserId: lawyerId ? Number(lawyerId) : undefined,
                        })
                      }
                    >
                      {acceptOrder.isPending ? t("common.loading") : t("services.accept")}
                    </Button>
                  </div>
                ) : null}

                {order.caseId &&
                ["accepted", "in_progress", "revision_requested", "delivered"].includes(
                  order.status
                ) &&
                !order.assignedLawyerUserId ? (
                  <div className="space-y-2">
                    <Label>{t("services.assignLawyer")}</Label>
                    <Select value={lawyerId} onValueChange={setLawyerId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("services.assignLawyer")} />
                      </SelectTrigger>
                      <SelectContent>
                        {lawyers.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!lawyerId || assignLawyer.isPending}
                      onClick={() =>
                        assignLawyer.mutate({
                          orderId: order.id,
                          lawyerUserId: Number(lawyerId),
                        })
                      }
                    >
                      {assignLawyer.isPending ? t("common.loading") : t("services.assignLawyer")}
                    </Button>
                  </div>
                ) : null}

                {/* Document delivery */}
                {isDoc &&
                ["accepted", "in_progress", "revision_requested", "delivered"].includes(
                  order.status
                ) ? (
                  <div className="space-y-2">
                    <Label>{t("services.uploadDelivery")}</Label>
                    <Textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder={t("services.deliveryNotePlaceholder")}
                      rows={2}
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                      >
                        <FileUp className="w-3.5 h-3.5 me-1.5" />
                        {uploading ? t("common.loading") : t("services.attachFiles")}
                      </Button>
                      <Button
                        size="sm"
                        disabled={pendingFiles.length === 0 || deliverWork.isPending}
                        onClick={() =>
                          deliverWork.mutate({
                            orderId: order.id,
                            note: deliveryNote.trim() || undefined,
                            attachments: pendingFiles,
                          })
                        }
                      >
                        {deliverWork.isPending ? t("common.loading") : t("services.sendDelivery")}
                      </Button>
                    </div>
                    {pendingFiles.map((f) => (
                      <p key={f.fileKey} className="text-xs text-muted-foreground">
                        {f.fileName}
                      </p>
                    ))}
                  </div>
                ) : null}

                {/* Consultation remarks */}
                {isConsult &&
                ["accepted", "in_progress", "delivered"].includes(order.status) ? (
                  <div className="space-y-2">
                    <Label>{t("services.lawyerRemarks")}</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={4}
                      placeholder={t("services.remarksPlaceholder")}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={remarks.trim().length < 3 || addRemarks.isPending}
                        onClick={() =>
                          addRemarks.mutate({
                            orderId: order.id,
                            remarks: remarks.trim(),
                            complete: false,
                          })
                        }
                      >
                        {t("services.saveRemarks")}
                      </Button>
                      <Button
                        disabled={remarks.trim().length < 3 || addRemarks.isPending}
                        onClick={() =>
                          addRemarks.mutate({
                            orderId: order.id,
                            remarks: remarks.trim(),
                            complete: true,
                          })
                        }
                      >
                        {t("services.completeWithRemarks")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {["accepted", "in_progress", "delivered", "revision_requested"].includes(
                  order.status
                ) ? (
                  <Button
                    variant="outline"
                    disabled={completeOrder.isPending}
                    onClick={() => completeOrder.mutate({ orderId: order.id })}
                  >
                    {completeOrder.isPending ? t("common.loading") : t("services.complete")}
                  </Button>
                ) : null}

                {order.status === "completed" && !order.isLocked ? (
                  <p className="text-xs text-muted-foreground">{t("services.lockCountdown")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
