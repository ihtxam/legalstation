import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentExchange } from "@/components/DocumentExchange";
import { CaseStatusTimeline } from "@/components/CaseStatusTimeline";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  MessageSquare,
  Calendar,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ClientPortalPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data: cases, isLoading: casesLoading } = trpc.cases.list.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const { data: selectedCase, isLoading: caseLoading } = trpc.cases.get.useQuery(
    { id: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: documents, isLoading: docsLoading } = trpc.documents.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: events, isLoading: eventsLoading } = trpc.cases.getEvents.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const { data: messages } = trpc.messages.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  // Document summaries - will be fetched on-demand by DocumentSummaryCard
  const [summaries, setSummaries] = useState<Record<number, any>>({});
  const [summariesLoading, setSummariesLoading] = useState<Record<number, boolean>>({});

  const updateDocVisibility = trpc.documents.updateVisibility.useMutation();
  const deleteDocument = trpc.documents.delete.useMutation();
  const logDocAccess = trpc.documents.logAccess.useMutation();
  const registerDocument = trpc.documents.register.useMutation();
  const analyzeDocument = trpc.documentAnalysis.analyzeDocument.useMutation();
  const utils = trpc.useUtils();
  const { refetch: refetchDocs } = trpc.documents.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  useEffect(() => {
    if (!documents?.length) return;
    let cancelled = false;
    (async () => {
      for (const item of documents) {
        const doc = item.doc;
        if (!doc?.id || summaries[doc.id] || summariesLoading[doc.id]) continue;
        try {
          const summary = await utils.documentAnalysis.getSummary.fetch({ documentId: doc.id });
          if (!cancelled && summary) {
            setSummaries((prev) => ({ ...prev, [doc.id]: summary }));
          }
        } catch {
          // ignore missing summaries
        }
      }
    })();
    return () => { cancelled = true; };
  }, [documents]);

  if (loading) return <LexLayout title="My Cases"><Skeleton className="h-64 w-full" /></LexLayout>;

  const clientCases = cases || [];
  const activeCase = selectedCaseId
    ? clientCases.find((c) => c.id === selectedCaseId)
    : null;

  return (
    <LexLayout breadcrumb={[{ label: "My Cases" }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          {branding?.logoUrl && (
            <img src={branding.logoUrl} alt="Firm logo" className="h-12 w-auto object-contain" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Cases</h1>
            <p className="text-muted-foreground mt-2">
              View your legal cases, documents, and updates from {branding?.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cases Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/40">
                <h2 className="font-semibold text-foreground text-sm">
                  Cases ({clientCases.length})
                </h2>
              </div>
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {casesLoading ? (
                  <div className="p-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : clientCases.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No cases yet
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
                      <p className="font-medium text-sm text-foreground truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.referenceNumber}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Case Details */}
          <div className="lg:col-span-3">
            {!selectedCaseId ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">
                  Select a case to view details
                </p>
              </div>
            ) : caseLoading ? (
              <div className="bg-card border border-border rounded-xl p-6">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : activeCase ? (
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {activeCase.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reference: {activeCase.referenceNumber}
                      </p>
                    </div>
                    <Badge
                      className={
                        activeCase.status === "open"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {activeCase.status}
                    </Badge>
                  </div>

                  {activeCase.description && (
                    <p className="text-sm text-muted-foreground">
                      {activeCase.description}
                    </p>
                  )}

                  {activeCase.deadline && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Deadline:{" "}
                        {format(new Date(activeCase.deadline), "dd MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="documents" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Documents</span>
                    </TabsTrigger>
                    <TabsTrigger value="updates" className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Updates</span>
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">Messages</span>
                      {messages && messages.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {messages.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Documents Tab */}
                  <TabsContent value="documents" className="space-y-4">
                    <DocumentExchange
                      docs={documents || []}
                      isLoading={docsLoading}
                      canUpload={true}
                      canShare={true}
                      onUpload={async (file) => {
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("caseId", selectedCaseId.toString());
                        try {
                          const res = await fetch("/api/upload", {
                            method: "POST",
                            body: formData,
                          });
                          const { fileKey, fileUrl } = await res.json();
                          registerDocument.mutate(
                            {
                              caseId: selectedCaseId!,
                              name: file.name,
                              originalName: file.name,
                              mimeType: file.type || "application/octet-stream",
                              size: file.size,
                              fileKey,
                              fileUrl,
                              visibility: "shared",
                            },
                            {
                              onSuccess: async (result) => {
                                refetchDocs();
                                toast.success("Document uploaded successfully");
                                if (result.documentId && result.fileUrl) {
                                  setSummariesLoading((prev) => ({ ...prev, [result.documentId!]: true }));
                                  const toastId = toast.loading("Analyzing document with AI...");
                                  try {
                                    const analysis = await analyzeDocument.mutateAsync({
                                      documentId: result.documentId,
                                      documentUrl: result.fileUrl,
                                      fileName: result.name,
                                      mimeType: result.mimeType,
                                    });
                                    setSummaries((prev) => ({
                                      ...prev,
                                      [result.documentId!]: {
                                        documentId: result.documentId,
                                        status: "completed",
                                        ...analysis.summary,
                                        keyPoints: JSON.stringify(analysis.summary.keyPoints || []),
                                        extractedEntities: JSON.stringify(analysis.summary.extractedEntities || []),
                                      },
                                    }));
                                    toast.success("Document analysis complete", { id: toastId });
                                  } catch {
                                    setSummaries((prev) => ({
                                      ...prev,
                                      [result.documentId!]: {
                                        documentId: result.documentId,
                                        status: "failed",
                                        error: "Analysis failed",
                                      },
                                    }));
                                    toast.error("Document analysis failed", { id: toastId });
                                  } finally {
                                    setSummariesLoading((prev) => ({ ...prev, [result.documentId!]: false }));
                                  }
                                }
                              },
                              onError: () => {
                                toast.error("Failed to register document");
                              },
                            }
                          );
                        } catch (error) {
                          toast.error("Failed to upload document");
                        }
                      }}
                      onToggleVisibility={(id, visibility) => {
                        updateDocVisibility.mutate(
                          { id, visibility },
                          { onSuccess: () => refetchDocs() }
                        );
                      }}
                      onDelete={(id) => {
                        deleteDocument.mutate(
                          { id },
                          { onSuccess: () => refetchDocs() }
                        );
                      }}
                      onDownload={(id, name) => {
                        logDocAccess.mutate({ documentId: id, action: "download" });
                      }}
                      summaries={summaries}
                      summariesLoading={summariesLoading}
                    />
                  </TabsContent>

                  {/* Updates Tab */}
                  <TabsContent value="updates" className="space-y-4">
                    {eventsLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : events && events.length > 0 ? (
                      <CaseStatusTimeline events={events.map((e: any) => ({ id: e.event.id, eventType: e.event.eventType, createdAt: e.event.createdAt }))} isLoading={false} />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No updates yet
                      </div>
                    )}
                  </TabsContent>

                  {/* Messages Tab */}
                  <TabsContent value="messages" className="space-y-4">
                    {messages && messages.length > 0 ? (
                      <div className="space-y-4">
                        {messages.map((msg: any) => (
                          <div key={msg.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium text-sm text-foreground">
                                {msg.senderName || "Message"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(msg.createdAt), "dd MMM yyyy HH:mm")}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No messages yet
                      </div>
                    )}
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
