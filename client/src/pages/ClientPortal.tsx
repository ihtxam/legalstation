import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentExchange } from "@/components/DocumentExchange";
import { CaseStatusTimeline } from "@/components/CaseStatusTimeline";
import { CaseIntakeWizard } from "@/components/CaseIntakeWizard";
import { Badge } from "@/components/ui/badge";
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
import {
  FileText,
  MessageSquare,
  Calendar,
  AlertCircle,
  Send,
  Building2,
  Plus,
  Upload,
  ShoppingCart,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CASE_TYPE_LABELS } from "@shared/types";

export default function ClientPortalPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showLitige, setShowLitige] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [serviceBrief, setServiceBrief] = useState<Record<number, string>>({});
  const [litigeForm, setLitigeForm] = useState({
    title: "",
    type: "other" as keyof typeof CASE_TYPE_LABELS,
    description: "",
  });
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const litigeFileRef = useRef<HTMLInputElement>(null);
  const fulfillFileRef = useRef<HTMLInputElement>(null);
  const [fulfillingRequestId, setFulfillingRequestId] = useState<number | null>(null);
  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });
  const { data: mySub, refetch: refetchSub } = trpc.clientPackages.mySubscription.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: portalPackages } = trpc.clientPackages.listForClient.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const changePlan = trpc.clientPackages.changePlan.useMutation({
    onSuccess: async () => {
      toast.success(t("packages.planChanged"));
      setShowChangePlan(false);
      await refetchSub();
    },
    onError: (e) => toast.error(e.message),
  });
  const isSubscriber = mySub?.accessType === "subscriber";
  const shopServices = trpc.ondemandServices.listPublicForClient.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const cart = trpc.ondemandServices.getCart.useQuery(undefined, { enabled: isAuthenticated });
  const myOrders = trpc.ondemandServices.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const addToCart = trpc.ondemandServices.addToCart.useMutation({
    onSuccess: async () => {
      toast.success(t("services.addedToCart"));
      await cart.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateCartItem = trpc.ondemandServices.updateCartItem.useMutation({
    onSuccess: async () => {
      await cart.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const checkout = trpc.ondemandServices.checkout.useMutation({
    onSuccess: async (res) => {
      toast.success(t("services.checkoutSuccess"));
      setShowCart(false);
      setOrderNotes("");
      await Promise.all([cart.refetch(), myOrders.refetch()]);
      if (res.paymentUrl) window.location.href = res.paymentUrl;
    },
    onError: (e) => toast.error(e.message),
  });
  const cartCount = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data: cases, isLoading: casesLoading, refetch: refetchCases } = trpc.cases.list.useQuery(
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

  const {
    data: docRequests,
    refetch: refetchDocRequests,
  } = trpc.documentRequests.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: isAuthenticated && !!selectedCaseId }
  );

  const [summaries, setSummaries] = useState<Record<number, any>>({});
  const [summariesLoading, setSummariesLoading] = useState<Record<number, boolean>>({});

  const logDocAccess = trpc.documents.logAccess.useMutation();
  const getDownloadUrl = trpc.documents.getDownloadUrl.useMutation();
  const registerDocument = trpc.documents.register.useMutation();
  const analyzeDocument = trpc.documentAnalysis.analyzeDocument.useMutation();
  const fulfillRequest = trpc.documentRequests.fulfill.useMutation({
    onSuccess: () => {
      toast.success(t("portal.requestFulfilled"));
      void refetchDocRequests();
      void refetchDocs();
    },
    onError: (e) => toast.error(e.message),
  });
  const createLitige = trpc.cases.createLitige.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const sendMsg = trpc.messages.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      void refetchMessages();
    },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();

  const uploadAndRegister = async (
    caseId: number,
    file: File,
    opts?: { description?: string }
  ) => {
    const { postFileUpload } = await import("@/lib/uploadHelpers");
    const { fileKey, fileUrl } = await postFileUpload(file);
    const result = await registerDocument.mutateAsync({
      caseId,
      name: file.name,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      fileKey,
      fileUrl,
      description: opts?.description,
      visibility: "shared",
    });
    return { result, fileUrl, file };
  };

  // Prefetch existing AI summaries when docs load
  useEffect(() => {
    if (!documents?.length) return;
    let d = false;
    (async () => {
      for (const { doc } of documents) {
        if (d) break;
        try {
          const summary = await utils.documentAnalysis.getSummary.fetch({ documentId: doc.id });
          if (summary && !d) {
            setSummaries((prev) => (prev[doc.id] ? prev : { ...prev, [doc.id]: summary }));
          }
        } catch {
          // ignore missing summaries
        }
      }
    })();
    return () => {
      d = true;
    };
  }, [documents, utils.documentAnalysis.getSummary]);

  if (loading) {
    return (
      <AppLayout title={t("portal.title")}>
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  const clientCases = cases || [];
  const activeCase = selectedCase || clientCases.find((c) => c.id === selectedCaseId) || null;
  const pendingRequests = (docRequests || []).filter((r) => r.status === "pending");

  return (
    <AppLayout breadcrumb={[{ label: t("portal.title") }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
          <div className="flex items-center gap-3 flex-wrap">
            <LanguageSwitcher />
            <Button variant="outline" onClick={() => setShowCart(true)}>
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              {t("services.cart")}
              {cartCount > 0 ? ` (${cartCount})` : ""}
            </Button>
            <Button
              className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
              onClick={() => (isSubscriber ? setShowIntake(true) : setShowLitige(true))}
              disabled={isSubscriber && mySub?.hasSubscription && !mySub.quota.canCreateCase}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {isSubscriber ? t("packages.newLegalIssue") : t("portal.announceLitige")}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">
              {mySub?.hasSubscription
                ? t("packages.currentPlan", { name: mySub.package?.name })
                : t("packages.noActivePlan")}
            </p>
            {mySub?.hasSubscription ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("packages.quotaUsed", {
                  used: mySub.quota.casesUsed,
                  allowed: mySub.quota.casesAllowed,
                })}
                {mySub.package && Number(mySub.package.consultationHoursPerPeriod) > 0
                  ? ` · ${t("packages.consultHours", {
                      hours: mySub.package.consultationHoursPerPeriod,
                    })}`
                  : ""}
                {" · "}
                {t("packages.periodEnds", {
                  date: new Date(mySub.subscription!.currentPeriodEnd).toLocaleDateString(),
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{t("packages.plansHint")}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowChangePlan(true)}>
            {mySub?.hasSubscription ? t("packages.changePlan") : t("packages.plansForYou")}
          </Button>
        </div>

        {(shopServices.data || []).length > 0 && (
          <div className="space-y-3">
            <div>
              <h2 className="font-semibold text-foreground">{t("services.shopTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("services.shopHint")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(shopServices.data || []).map((svc) => (
                <div key={svc.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`services.cat.${svc.category}`)} · {svc.estimatedHours}h
                      </p>
                    </div>
                    <p className="font-semibold text-sm whitespace-nowrap">
                      {Number(svc.price).toFixed(2)} {svc.currency}
                    </p>
                  </div>
                  {svc.description ? (
                    <p className="text-sm text-muted-foreground">{svc.description}</p>
                  ) : null}
                  <Input
                    placeholder={t("services.brief")}
                    value={serviceBrief[svc.id] || ""}
                    onChange={(e) =>
                      setServiceBrief((prev) => ({ ...prev, [svc.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={addToCart.isPending}
                    onClick={() =>
                      addToCart.mutate({
                        serviceId: svc.id,
                        quantity: 1,
                        clientBrief: serviceBrief[svc.id]?.trim() || undefined,
                      })
                    }
                  >
                    {t("services.addToCart")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(myOrders.data || []).length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{t("services.myOrders")}</h3>
            {(myOrders.data || []).slice(0, 5).map(({ order, items }) => (
              <div
                key={order.id}
                className="border border-border rounded-xl px-4 py-3 text-sm flex flex-wrap justify-between gap-2 bg-card"
              >
                <div>
                  <p className="font-medium">
                    {order.orderNumber}{" "}
                    <Badge variant="outline" className="capitalize ms-1">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {items.map((i) => i.serviceName).join(", ")}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {Number(order.subtotal).toFixed(2)} {order.currency}
                </p>
              </div>
            ))}
          </div>
        )}

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
                  <div className="p-6 text-center space-y-3">
                    <p className="text-muted-foreground text-sm font-medium">{t("portal.empty")}</p>
                    <p className="text-xs text-muted-foreground">{t("portal.emptyHintAnnounce")}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (isSubscriber ? setShowIntake(true) : setShowLitige(true))}
                    >
                      {isSubscriber ? t("packages.newLegalIssue") : t("portal.announceLitige")}
                    </Button>
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
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                          : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/10 dark:text-zinc-300 dark:border-white/15"
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

                {pendingRequests.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-900">
                      {t("portal.documentRequests")} ({pendingRequests.length})
                    </p>
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-start justify-between gap-3 flex-wrap bg-card/70 rounded-md border border-amber-200 dark:border-amber-500/30 p-3"
                      >
                        <div>
                          <p className="font-medium text-sm text-foreground">{req.title}</p>
                          {req.description && (
                            <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                          )}
                          {req.dueDate && (
                            <p className="text-xs text-amber-800 mt-1">
                              {t("portal.due")}: {format(new Date(req.dueDate), "dd MMM yyyy")}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fulfillRequest.isPending && fulfillingRequestId === req.id}
                          onClick={() => {
                            setFulfillingRequestId(req.id);
                            fulfillFileRef.current?.click();
                          }}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {t("portal.uploadForRequest")}
                        </Button>
                      </div>
                    ))}
                    <input
                      ref={fulfillFileRef}
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        const requestId = fulfillingRequestId;
                        e.target.value = "";
                        if (!file || !requestId || !selectedCaseId) return;
                        try {
                          const { result } = await uploadAndRegister(selectedCaseId, file);
                          if (!result.documentId) throw new Error("Document not registered");
                          await fulfillRequest.mutateAsync({
                            requestId,
                            documentId: result.documentId,
                          });
                        } catch (err: any) {
                          toast.error(err.message || t("docs.uploadFailed"));
                        } finally {
                          setFulfillingRequestId(null);
                        }
                      }}
                    />
                  </div>
                )}

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
                      onUpload={async (file, opts) => {
                        const { isImageUpload } = await import("@shared/uploadPolicy");
                        const { result, fileUrl } = await uploadAndRegister(selectedCaseId!, file, {
                          description: opts?.description,
                        });
                        await refetchDocs();
                        if (result.documentId && !isImageUpload(file.type, file.name)) {
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

      <CaseIntakeWizard
        open={showIntake}
        onOpenChange={setShowIntake}
        allowedCaseTypes={mySub?.hasSubscription ? mySub.package?.allowedCaseTypes : null}
        onCreated={async (caseId) => {
          await refetchCases();
          await refetchSub();
          setSelectedCaseId(caseId);
        }}
      />

      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("packages.plansForYou")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("packages.plansHint")}</p>
          <div className="space-y-3">
            {(portalPackages || []).map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className="w-full text-start border rounded-xl p-3 hover:border-[var(--color-navy)] space-y-1"
                disabled={changePlan.isPending}
                onClick={() => changePlan.mutate({ packageId: pkg.id })}
              >
                <p className="font-medium">
                  {pkg.highlightLabel ? (
                    <Badge variant="outline" className="me-2">
                      {pkg.highlightLabel}
                    </Badge>
                  ) : null}
                  {pkg.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Number(pkg.price).toFixed(2)} {pkg.currency} / {pkg.billingInterval}
                  {pkg.consultationHoursPerPeriod > 0
                    ? ` · ${t("packages.consultHours", { hours: pkg.consultationHoursPerPeriod })}`
                    : ""}
                  {pkg.casesPerPeriod > 0
                    ? ` · ${t("packages.casesPerPeriod", { count: pkg.casesPerPeriod })}`
                    : ""}
                  {pkg.includedFixedHours > 0
                    ? ` · ${t("packages.fixedHours", { hours: pkg.includedFixedHours })}`
                    : ""}
                </p>
                {(pkg.features || []).length > 0 ? (
                  <ul className="text-xs text-muted-foreground list-disc ps-4">
                    {(pkg.features as string[]).slice(0, 4).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs font-medium text-[var(--color-navy)]">{t("packages.buyPlan")}</p>
              </button>
            ))}
            {!portalPackages?.length ? (
              <p className="text-sm text-muted-foreground">{t("packages.noPublicPackages")}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("services.cart")}</DialogTitle>
          </DialogHeader>
          {(cart.data?.items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("services.cartEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {(cart.data?.items || []).map((item) => (
                <div key={item.id} className="border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{item.serviceName}</p>
                    <p className="text-sm">
                      {(Number(item.unitPrice) * item.quantity).toFixed(2)} {item.currency}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">{t("services.quantity")}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-20 h-8"
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartItem.mutate({
                          itemId: item.id,
                          quantity: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="font-semibold text-sm">
                {Number(cart.data?.order.subtotal || 0).toFixed(2)} {cart.data?.order.currency}
              </p>
              <div>
                <Label>{t("services.orderNotes")}</Label>
                <Textarea
                  className="mt-1.5"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCart(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                checkout.isPending || !(cart.data?.items && cart.data.items.length > 0)
              }
              onClick={() =>
                checkout.mutate({
                  clientNotes: orderNotes.trim() || undefined,
                })
              }
            >
              {t("services.payAndOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLitige} onOpenChange={setShowLitige}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("portal.announceLitige")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t("portal.announceHint")}</p>
            <div>
              <Label htmlFor="litigeTitle">{t("portal.litigeTitle")}</Label>
              <Input
                id="litigeTitle"
                className="mt-1.5"
                value={litigeForm.title}
                onChange={(e) => setLitigeForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("common.type")}</Label>
              <Select
                value={litigeForm.type}
                onValueChange={(v) =>
                  setLitigeForm((f) => ({ ...f, type: v as keyof typeof CASE_TYPE_LABELS }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="litigeDesc">{t("portal.litigeDescription")}</Label>
              <Textarea
                id="litigeDesc"
                className="mt-1.5 min-h-28"
                value={litigeForm.description}
                onChange={(e) => setLitigeForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("portal.attachDocsOptional")}</Label>
              <input
                ref={litigeFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPendingUploadFiles(files);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-1.5 w-full justify-start"
                onClick={() => litigeFileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                {pendingUploadFiles.length
                  ? t("portal.filesSelected", { count: pendingUploadFiles.length })
                  : t("portal.chooseFiles")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLitige(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
              disabled={
                createLitige.isPending ||
                litigeForm.title.trim().length < 3 ||
                litigeForm.description.trim().length < 10
              }
              onClick={async () => {
                try {
                  const created = await createLitige.mutateAsync({
                    title: litigeForm.title.trim(),
                    type: litigeForm.type,
                    description: litigeForm.description.trim(),
                  });
                  for (const file of pendingUploadFiles) {
                    await uploadAndRegister(created.id, file);
                  }
                  toast.success(t("portal.litigeCreated"));
                  setShowLitige(false);
                  setLitigeForm({ title: "", type: "other", description: "" });
                  setPendingUploadFiles([]);
                  const refreshed = await refetchCases();
                  setSelectedCaseId(created.id);
                  if (!refreshed.data?.some((c) => c.id === created.id)) {
                    await refetchCases();
                  }
                } catch (err: any) {
                  toast.error(err.message || t("portal.litigeFailed"));
                }
              }}
            >
              {createLitige.isPending ? t("common.creating") : t("portal.submitLitige")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
