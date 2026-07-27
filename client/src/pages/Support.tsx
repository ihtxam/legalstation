import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useTranslation } from "react-i18next";
import { BookOpen, ExternalLink, LifeBuoy, Plus, Paperclip, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_UPLOAD_POLICY,
  acceptAttribute,
  formatBytes,
  validateUploadFile,
} from "@shared/uploadPolicy";

/** Help center is per-language: /help (en) or /help/{fr,de,it,ar}/ */
function helpUrlFor(language: string | undefined): string {
  const lang = (language || "en").slice(0, 2).toLowerCase();
  return ["fr", "de", "it", "ar"].includes(lang) ? `/help/${lang}/` : "/help";
}
const TICKET_ACCEPT = acceptAttribute(TICKET_UPLOAD_POLICY.allowedExtensions);

type Attachment = {
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType?: string | null;
  size: number;
};

async function uploadTicketAttachment(file: File): Promise<Attachment> {
  const check = validateUploadFile({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    policy: TICKET_UPLOAD_POLICY,
  });
  if (!check.ok) throw new Error(check.message);

  const fd = new FormData();
  fd.append("file", file);
  fd.append("purpose", "ticket_attachment");
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? "Upload failed" : `Upload failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  const fileKey = data.key || data.fileKey;
  const fileUrl = data.url || data.fileUrl;
  if (!fileKey || !fileUrl) throw new Error("Upload failed: missing file reference");
  return {
    fileName: file.name,
    fileKey,
    fileUrl,
    mimeType: file.type,
    size: file.size,
  };
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "closed") return "secondary";
  if (status === "resolved") return "outline";
  if (status === "critical" || status === "open") return "default";
  return "outline";
}

export default function SupportPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const {
    data: firmData,
    isLoading: firmLoading,
    isFetched: firmFetched,
  } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });

  const firmRole = firmData?.member?.firmRole;
  const canUseTickets = Boolean(
    firmRole === "admin" ||
      firmRole === "subadmin" ||
      firmRole === "lawyer" ||
      firmRole === "assistant" ||
      firmData?.capabilities?.canAccessAdminConsole
  );
  const showTicketsLoading = Boolean(user) && user?.role !== "superadmin" && (firmLoading || !firmFetched);

  const utils = trpc.useUtils();
  const { data: quota } = trpc.supportTickets.quota.useQuery(undefined, { enabled: canUseTickets });
  const { data: tickets, refetch: refetchTickets } = trpc.supportTickets.listMine.useQuery(undefined, {
    enabled: canUseTickets,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sensitivity, setSensitivity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);

  const { data: detail, refetch: refetchDetail } = trpc.supportTickets.get.useQuery(
    { id: selectedId! },
    { enabled: canUseTickets && selectedId != null }
  );

  const createMutation = trpc.supportTickets.create.useMutation({
    onSuccess: (r) => {
      toast.success(t("support.ticketCreated", { number: r.ticketNumber }));
      setShowCreate(false);
      setSubject("");
      setBody("");
      setSensitivity("medium");
      setAttachments([]);
      void refetchTickets();
      void utils.supportTickets.quota.invalidate();
      void utils.supportTickets.unreadCount.invalidate();
      setSelectedId(r.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const replyMutation = trpc.supportTickets.reply.useMutation({
    onSuccess: () => {
      toast.success(t("support.replySent"));
      setReply("");
      setReplyAttachments([]);
      void refetchDetail();
      void refetchTickets();
      void utils.supportTickets.unreadCount.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const canCreate = useMemo(() => {
    if (!quota) return true;
    return quota.remaining > 0;
  }, [quota]);

  const onPickFiles = async (
    files: FileList | null,
    setter: (fn: (prev: Attachment[]) => Attachment[]) => void
  ) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const next: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const check = validateUploadFile({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          policy: TICKET_UPLOAD_POLICY,
        });
        if (!check.ok) {
          toast.error(
            check.code === "FILE_TOO_LARGE"
              ? t("support.fileTooLarge", { max: formatBytes(TICKET_ATTACHMENT_MAX_BYTES) })
              : t("support.fileTypeNotAllowed")
          );
          continue;
        }
        next.push(await uploadTicketAttachment(file));
      }
      if (next.length) setter((prev) => [...prev, ...next].slice(0, 5));
    } catch (e: any) {
      toast.error(e.message || t("support.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title={t("support.title")} breadcrumb={[{ label: t("support.title") }]}>
      <div className="page-shell max-w-4xl !space-y-6 sm:!space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-[var(--color-navy)]">
              <LifeBuoy className="w-6 h-6 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight">
                {t("support.heading")}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{t("support.introTickets")}</p>
          </div>
          {canUseTickets && (
            <Button
              className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90 w-full sm:w-auto shrink-0"
              disabled={!canCreate}
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("support.newTicket")}
            </Button>
          )}
        </div>

        {showTicketsLoading && (
          <section className="border border-border rounded-xl p-4 sm:p-6 space-y-3 bg-card">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
          </section>
        )}

        {canUseTickets && (
          <section className="border border-[var(--color-navy)]/25 rounded-xl p-4 sm:p-6 space-y-4 bg-card shadow-sm">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 shrink-0" />
                {t("support.ticketsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{t("support.ticketsHint")}</p>
              {quota && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t("support.quotaLine", { used: quota.used, limit: quota.limit })}
                </p>
              )}
            </div>

            <div className="divide-y border rounded-lg">
              {(tickets || []).map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                    <Badge variant={statusVariant(ticket.status)}>
                      {t(`support.status.${ticket.status}`)}
                    </Badge>
                    <Badge variant="outline">{t(`support.sensitivity.${ticket.sensitivity}`)}</Badge>
                    {ticket.hasUnread && (
                      <Badge className="bg-[var(--color-gold)] text-white">{t("support.unread")}</Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm mt-1">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </p>
                </button>
              ))}
              {!tickets?.length && (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("support.noTickets")}</p>
              )}
            </div>
          </section>
        )}

        {!showTicketsLoading && !canUseTickets && firmData && (
          <section className="border border-border rounded-xl p-4 sm:p-6 bg-muted/30">
            <p className="text-sm text-muted-foreground">{t("support.ticketsStaffOnly")}</p>
          </section>
        )}

        <section className="border border-border rounded-xl p-4 sm:p-5 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-muted p-2 shrink-0">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-2 flex-1">
              <h3 className="font-medium text-sm text-foreground">{t("support.docsTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("support.docsHint")}</p>
              <Button asChild variant="outline" size="sm">
                <a href={helpUrlFor(i18n.language)} target="_blank" rel="noreferrer">
                  {t("support.openLocalHelp")}
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("support.newTicket")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("support.subject")}</Label>
              <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>{t("support.sensitivityLabel")}</Label>
              <Select
                value={sensitivity}
                onValueChange={(v) => setSensitivity(v as typeof sensitivity)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("support.sensitivity.low")}</SelectItem>
                  <SelectItem value="medium">{t("support.sensitivity.medium")}</SelectItem>
                  <SelectItem value="high">{t("support.sensitivity.high")}</SelectItem>
                  <SelectItem value="critical">{t("support.sensitivity.critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("support.description")}</Label>
              <Textarea className="mt-1" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <Label>{t("support.attachments")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("support.attachmentsHint")}</p>
              <div className="mt-1 flex flex-wrap gap-2 items-center">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 mr-1" />
                    {uploading ? t("support.uploading") : t("support.attach")}
                    <input
                      type="file"
                      accept={TICKET_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void onPickFiles(e.target.files, setAttachments);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                {attachments.map((a) => (
                  <a key={a.fileKey} href={a.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                    {a.fileName}
                  </a>
                ))}
              </div>
            </div>
            <Button
              className="w-full bg-[var(--color-navy)]"
              disabled={createMutation.isPending || subject.trim().length < 3 || body.trim().length < 10}
              onClick={() =>
                createMutation.mutate({
                  subject,
                  body,
                  sensitivity,
                  attachments,
                })
              }
            >
              {createMutation.isPending ? t("common.loading") : t("support.submitTicket")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedId != null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{detail?.ticket.ticketNumber}</span>
              {detail && (
                <>
                  <Badge variant={statusVariant(detail.ticket.status)}>
                    {t(`support.status.${detail.ticket.status}`)}
                  </Badge>
                  <span className="text-base font-semibold">{detail.ticket.subject}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="space-y-3">
                {detail.messages.map((m) => {
                  const atts = detail.attachments.filter((a) => a.messageId === m.id);
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-3 text-sm ${
                        m.authorKind === "superadmin" ? "bg-muted/40" : "bg-card"
                      }`}
                    >
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                        <span>
                          {m.authorKind === "superadmin"
                            ? t("support.fromCliavo")
                            : m.authorName || t("support.fromYou")}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {atts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {atts.map((a) => (
                            <a
                              key={a.id}
                              href={a.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline"
                            >
                              {a.fileName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {detail.ticket.status !== "closed" ? (
                <div className="space-y-2 border-t pt-3">
                  <Label>{t("support.addReply")}</Label>
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <label className="cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5 mr-1" />
                        {t("support.attach")}
                        <input
                          type="file"
                          accept={TICKET_ACCEPT}
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void onPickFiles(e.target.files, setReplyAttachments);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </Button>
                    {replyAttachments.map((a) => (
                      <span key={a.fileKey} className="text-xs">{a.fileName}</span>
                    ))}
                    <Button
                      className="ml-auto bg-[var(--color-navy)]"
                      disabled={!reply.trim() || replyMutation.isPending}
                      onClick={() =>
                        replyMutation.mutate({
                          ticketId: detail.ticket.id,
                          body: reply,
                          attachments: replyAttachments,
                        })
                      }
                    >
                      {t("support.sendReply")}
                    </Button>
                  </div>
                  {detail.ticket.status === "resolved" && detail.ticket.autoCloseAt && (
                    <p className="text-xs text-amber-700">
                      {t("support.autoCloseHint", {
                        date: new Date(detail.ticket.autoCloseAt).toLocaleDateString(),
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("support.ticketClosed")}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
