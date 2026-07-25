import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentExchange } from "@/components/DocumentExchange";
import { CaseStatusTimeline } from "@/components/CaseStatusTimeline";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  MessageSquare,
  Calendar,
  AlertCircle,
  Send,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ClientPortalPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data: cases, isLoading: casesLoading } = trpc.cases.list.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!selectedCaseId && cases?.length) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  const { data: selectedCase, isLoading: caseLoading } = trpc.cases.get.useQuery(
    { id: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } = trpc.documents.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: events, isLoading: eventsLoading } = trpc.cases.getEvents.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: messages, refetch: refetchMessages } = trpc.messages.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const [summaries, setSummaries] = useState<Record<number, any>>({});
  const [summariesLoading, setSummariesLoading] = useState<Record<number, boolean>>({});

  const logDocAccess = trpc.documents.logAccess.useMutation();
  const getDownloadUrl = trpc.documents.getDownloadUrl.useMutation();
  const registerDocument = trpc.documents.register.useMutation();
  const analyzeDocument = trpc.documentAnalysis.analyzeDocument.useMutation();
  const sendMsg = trpc.messages.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      void refetchMessages();
    },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();

  // Prefetch existing AI summaries when docs load
  useEffect(() => {
    if (!documents?.length) return;
    let cancelled = false;
    (async () => {
      for (const { doc } of documents) {
        if (cancelled) break;
        try {
          const summary = await utils.documentAnalysis.getSummary.fetch({ documentId: doc.id });
          if (summary && !cancelled) {
            setSummaries((prev) => (prev[doc.id] ? prev : { ...prev, [doc.id]: summary }));
          }
        } catch {
          // ignore missing summaries
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documents, utils.documentAnalysis.getSummary]);

  if (loading) {
    return (
      <LexLayout title={t("portal.title")}>
        <Skeleton className="h-64 w-full" />
      </LexLayout>
    );
  }

  const clientCases = cases || [];
  const activeCase = selectedCase || clientCases.find((c) => c.id === selectedCaseId) || null;

  return (
    <LexLayout breadcrumb={[{ label: t("portal.title") }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-4">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name || t("settings.logo")}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[var(--color-navy)]" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("portal.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {branding?.name
                ? t("portal.subtitle", { firm: branding.name })
                : t("portal.subtitleFallback")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/40">
                <h2 className="font-semibold text-foreground text-sm">
                  {t("portal.casesCount", { count: clientCases.length })}
                </h2>
              </div>
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {casesLoading ? (
                  <div className="p-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : clientCases.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-muted-foreground text-sm font-medium">{t("portal.empty")}</p>
                    <p className="text-xs text-muted-foreground">{t("portal.emptyHint")}</p>
                  </div>
                ) : (
                  clientCases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${
                        selectedCaseId === c.id ? "bg-muted/80" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                          {t(`common.${c.status}`, { defaultValue: c.status })}
                        </Badge>
                      </div>
                      {c.referenceNumber && (
                        <p className="text-xs text-muted-foreground mt-1">{c.referenceNumber}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {!selectedCaseId ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">{t("portal.selectCase")}</p>
              </div>
            ) : caseLoading && !activeCase ? (
              <div className="bg-card border border-border rounded-xl p-6">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : activeCase ? (
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{activeCase.title}</h2>
                      {activeCase.referenceNumber && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("portal.referencePrefix")} {activeCase.referenceNumber}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        activeCase.status === "open"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {t(`common.${activeCase.status}`, { defaultValue: activeCase.status })}
                    </Badge>
                  </div>

                  {activeCase.description && (
                    <p className="text-sm text-muted-foreground">{activeCase.description}</p>
                  )}

                  {activeCase.deadline && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {t("portal.deadline")}:{" "}
                        {format(new Date(activeCase.deadline), "dd MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                <Tabs defaultValue="documents" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">{t("portal.documents")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="updates" className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">{t("portal.updates")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">{t("portal.messages")}</span>
                      {messages && messages.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                          {messages.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="documents" className="space-y-4">
                    <DocumentExchange
                      docs={documents || []}
                      isLoading={docsLoading}
                      canUpload={true}
                      canShare={false}
                      onUpload={async (file) => {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (!res.ok) throw new Error("Upload failed");
                        const { fileKey, fileUrl } = await res.json();
                        const result = await registerDocument.mutateAsync({
                          caseId: selectedCaseId!,
                          name: file.name,
                          originalName: file.name,
                          mimeType: file.type || "application/octet-stream",
                          size: file.size,
                          fileKey,
                          fileUrl,
                          visibility: "shared",
                        });
                        await refetchDocs();
                        if (result.documentId) {
                          const docId = result.documentId;
                          setSummariesLoading((prev) => ({ ...prev, [docId]: true }));
                          try {
                            await analyzeDocument.mutateAsync({
                              documentId: docId,
                              documentUrl: fileUrl,
                              fileName: file.name,
                              mimeType: file.type || "application/octet-stream",
                            });
                            const summary = await utils.documentAnalysis.getSummary.fetch({
                              documentId: docId,
                            });
                            if (summary) setSummaries((prev) => ({ ...prev, [docId]: summary }));
                            toast.success(t("docs.analysisComplete"));
                          } catch {
                            toast.error(t("docs.analysisFailed"));
                          } finally {
                            setSummariesLoading((prev) => ({ ...prev, [docId]: false }));
                          }
                        }
                      }}
                      onToggleVisibility={() => undefined}
                      onDelete={() => undefined}
                      onDownload={async (id) => {
                        try {
                          const { url } = await getDownloadUrl.mutateAsync({ documentId: id });
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (e: any) {
                          toast.error(e.message || t("docs.downloadFailed"));
                          logDocAccess.mutate({ documentId: id, action: "download" });
                        }
                      }}
                      summaries={summaries}
                      summariesLoading={summariesLoading}
                    />
                  </TabsContent>

                  <TabsContent value="updates" className="space-y-4">
                    {eventsLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : events && events.length > 0 ? (
                      <CaseStatusTimeline
                        events={events.map((e: any) => ({
                          id: e.event.id,
                          eventType: e.event.eventType,
                          createdAt: e.event.createdAt,
                        }))}
                        isLoading={false}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        {t("portal.noUpdates")}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="messages" className="space-y-4">
                    {messages && messages.length > 0 ? (
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {messages.map(({ message, sender }: any) => (
                          <div key={message.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium text-sm text-foreground">
                                {sender?.name || t("messages.message")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(message.createdAt), "dd MMM yyyy HH:mm")}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        {t("messages.noMessages")}
                      </div>
                    )}
                    <div className="flex gap-3 pt-2 border-t border-border">
                      <Textarea
                        className="flex-1 resize-none min-h-0 h-20"
                        placeholder={t("messages.placeholder")}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                      />
                      <Button
                        className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white shrink-0 self-end"
                        disabled={!newMessage.trim() || sendMsg.isPending}
                        onClick={() =>
                          sendMsg.mutate({
                            caseId: selectedCaseId!,
                            content: newMessage.trim(),
                          })
                        }
                      >
                        <Send className="w-4 h-4 mr-1.5" />
                        {t("messages.send")}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </LexLayout>
  );
}
