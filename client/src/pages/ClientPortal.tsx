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

export default function ClientPortalPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);

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
  const { refetch: refetchDocs } = trpc.documents.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  if (loading) return <LexLayout title="My Cases"><Skeleton className="h-64 w-full" /></LexLayout>;

  const clientCases = cases || [];
  const activeCase = selectedCaseId
    ? clientCases.find((c) => c.id === selectedCaseId)
    : null;

  return (
    <LexLayout breadcrumb={[{ label: "My Cases" }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Cases</h1>
          <p className="text-muted-foreground mt-1">
            View your cases, documents, and communications
          </p>
        </div>

        {/* Cases List & Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cases Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-foreground text-sm mb-3">
                Your Cases
              </h2>
              {casesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : clientCases.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No cases assigned yet
                </p>
              ) : (
                <div className="space-y-1">
                  {clientCases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                        selectedCaseId === c.id
                          ? "bg-[var(--color-navy)] text-white"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.title}</p>
                          <p className="text-xs opacity-75">#{c.referenceNumber}</p>
                        </div>
                        {selectedCaseId === c.id && (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Case Detail */}
          <div className="lg:col-span-2">
            {!selectedCaseId ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a case to view details</p>
              </div>
            ) : caseLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : activeCase ? (
              <div className="space-y-6">
                {/* Case Header */}
                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
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
                      onUpload={async (file) => {
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("caseId", selectedCaseId.toString());
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
                            mimeType: file.type,
                            size: file.size,
                            fileKey,
                            fileUrl,
                          },
                          {
                            onSuccess: async (result: any) => {
                              refetchDocs();
                              // Trigger AI analysis if document was created
                              if (result.documentId) {
                                setSummariesLoading((prev) => ({ ...prev, [result.documentId]: true }));
                                // Trigger analysis in background (fire and forget)
                                // Analysis will be fetched when user views the document
                                setSummariesLoading((prev) => ({ ...prev, [result.documentId]: false }));
                              }
                            },
                          }
                        );
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
                        const doc = documents?.find((d: any) => d.doc.id === id);
                        if (doc?.doc.fileUrl) {
                          const link = document.createElement("a");
                          link.href = doc.doc.fileUrl;
                          link.download = name;
                          link.click();
                        }
                      }}
                      canUpload={true}
                      canShare={false}
                      summaries={summaries}
                      summariesLoading={summariesLoading}
                    />
                  </TabsContent>

                  {/* Updates Tab */}
                  <TabsContent value="updates" className="space-y-4">
                    <CaseStatusTimeline
                      events={(events || []).map((e: any) => ({
                        id: e.event.id,
                        eventType: e.event.eventType,
                        title: e.event.title,
                        content: e.event.content,
                        visibility: e.event.visibility,
                        createdAt: e.event.createdAt,
                        author: e.author,
                      }))}
                      isLoading={eventsLoading}
                    />
                  </TabsContent>

                  {/* Messages Tab */}
                  <TabsContent value="messages" className="space-y-4">
                    <div className="bg-card border border-border rounded-lg p-6 text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {messages && messages.length > 0
                          ? "Messages will be displayed here"
                          : "No messages yet"}
                      </p>
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
