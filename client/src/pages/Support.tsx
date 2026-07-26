import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useTranslation } from "react-i18next";
import { Mail, BookOpen, ExternalLink, LifeBuoy, Plus, Paperclip, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const SUPPORT_EMAIL = "support@cliavo.com";
const DOCS_URL = "https://docs.cliavo.com";
const LOCAL_HELP_URL = "/help";

type Attachment = {
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType?: string | null;
  size: number;
};

async function uploadScreenshot(file: File): Promise<Attachment> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("purpose", "ticket_screenshot");
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return {
    fileName: file.name,
    fileKey: data.key || data.fileKey,
    fileUrl: data.url || data.fileUrl,
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });
  const isFirmAdmin =
    firmData?.member?.firmRole === "admin" || firmData?.member?.firmRole === "subadmin";

  const utils = trpc.useUtils();
  const { data: quota } = trpc.supportTickets.quota.useQuery(undefined, { enabled: isFirmAdmin });
  const { data: tickets, refetch: refetchTickets } = trpc.supportTickets.listMine.useQuery(undefined, {
    enabled: isFirmAdmin,
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
    { enabled: isFirmAdmin && selectedId != null }
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
        if (!file.type.startsWith("image/")) {
          toast.error(t("support.screenshotsOnly"));
          continue;
        }
        next.push(await uploadScreenshot(file));
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
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-navy)]">
            <LifeBuoy className="w-6 h-6" />
            <h2 className="text-2xl font-serif font-semibold tracking-tight">{t("support.heading")}</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{t("support.intro")}</p>
        </div>

        {isFirmAdmin && (
          <section className="border border-border rounded-xl p-6 space-y-4 bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {t("support.ticketsTitle")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{t("support.ticketsHint")}</p>
                {quota && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("support.quotaLine", { used: quota.used, limit: quota.limit })}
                  </p>
                )}
              </div>
              <Button
                className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90"
                disabled={!canCreate}
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t("support.newTicket")}
              </Button>
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

        <section className="border border-border rounded-xl p-6 space-y-4 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-[var(--color-navy)]/8 p-2">
              <Mail className="w-5 h-5 text-[var(--color-navy)]" />
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold text-foreground">{t("support.emailTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("support.emailHint")}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 text-[var(--color-navy)] font-medium hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        <section className="border border-border rounded-xl p-6 space-y-4 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-[var(--color-navy)]/8 p-2">
              <BookOpen className="w-5 h-5 text-[var(--color-navy)]" />
            </div>
            <div className="min-w-0 space-y-3 flex-1">
              <h3 className="font-semibold text-foreground">{t("support.docsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("support.docsHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90">
                  <a href={DOCS_URL} target="_blank" rel="noreferrer">
                    {t("support.openDocs")}
                    <ExternalLink className="w-4 h-4 ml-1.5" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={LOCAL_HELP_URL} target="_blank" rel="noreferrer">
                    {t("support.openLocalHelp")}
                  </a>
                </Button>
              </div>
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
              <Label>{t("support.screenshots")}</Label>
              <div className="mt-1 flex flex-wrap gap-2 items-center">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 mr-1" />
                    {uploading ? t("support.uploading") : t("support.attach")}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files, setAttachments)}
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
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => onPickFiles(e.target.files, setReplyAttachments)}
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
