import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function formatMessageDay(date: Date, t: (k: string) => string) {
  if (isToday(date)) return t("messages.today");
  if (isYesterday(date)) return t("messages.yesterday");
  return format(date, "dd MMM yyyy");
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: cases, isLoading } = trpc.cases.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<Set<number>>(new Set());

  const { data: msgs, refetch: refetchMsgs, isLoading: msgsLoading } =
    trpc.messages.list.useQuery(
      { caseId: selectedCaseId! },
      { enabled: selectedCaseId !== null }
    );
  const sendMsg = trpc.messages.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      void refetchMsgs();
    },
    onError: (e) => toast.error(e.message),
  });
  const markRead = trpc.messages.markRead.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  // Desktop: auto-select first case. Mobile: stay on list until tapped.
  useEffect(() => {
    if (!cases?.length || selectedCaseId != null) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (!msgs?.length) return;
    for (const m of msgs) {
      if (markedRef.current.has(m.message.id)) continue;
      markedRef.current.add(m.message.id);
      markRead.mutate({ messageId: m.message.id });
    }
  }, [msgs]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, selectedCaseId]);

  const selectedCase = cases?.find((c) => c.id === selectedCaseId);

  type MsgRow = NonNullable<typeof msgs>[number];
  const threadGroups = useMemo(() => {
    if (!msgs?.length) return [] as Array<{ day: string; items: MsgRow[] }>;
    const groups: Array<{ day: string; items: MsgRow[] }> = [];
    for (const row of msgs) {
      const day = formatMessageDay(new Date(row.message.createdAt), t);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(row);
      else groups.push({ day, items: [row] });
    }
    return groups;
  }, [msgs, t]);

  const openCase = (id: number) => {
    setSelectedCaseId(id);
    setMobileShowThread(true);
  };

  const backToList = () => {
    setMobileShowThread(false);
  };

  const send = () => {
    if (!selectedCaseId || !newMessage.trim()) return;
    sendMsg.mutate({ caseId: selectedCaseId, content: newMessage.trim() });
  };

  const conversationList = (
    <div className="flex flex-col h-full min-h-0 bg-card md:border-e md:border-border">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="font-semibold text-sm text-foreground">{t("messages.conversations")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("messages.conversationsHint")}
        </p>
      </div>
      <div className="flex-1 overflow-auto overscroll-contain">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : !cases?.length ? (
          <div className="p-8 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">{t("messages.emptyCases")}</p>
          </div>
        ) : (
          <ul className="p-2 space-y-1">
            {cases.map((c) => {
              const active = selectedCaseId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openCase(c.id)}
                    className={cn(
                      "w-full text-start rounded-xl px-3 py-3 transition-colors",
                      active
                        ? "bg-[var(--color-navy)]/12 text-foreground ring-1 ring-[var(--color-navy)]/25"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug line-clamp-2">{c.title}</p>
                      <Badge
                        variant={c.status === "open" ? "default" : "secondary"}
                        className="shrink-0 capitalize text-[10px]"
                      >
                        {t(`common.${c.status}`, { defaultValue: c.status })}
                      </Badge>
                    </div>
                    {c.referenceNumber ? (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {c.referenceNumber}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const threadPane = (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {!selectedCase ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <p className="font-medium text-foreground">{t("messages.selectCase")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("messages.selectCaseHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="px-3 sm:px-5 py-3 border-b border-border bg-card shrink-0 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={backToList}
              aria-label={t("messages.backToConversations")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                {selectedCase.title}
              </h3>
              <p className="text-xs text-muted-foreground capitalize">
                {t(`common.${selectedCase.status}`, { defaultValue: selectedCase.status })}
                {selectedCase.referenceNumber ? ` · ${selectedCase.referenceNumber}` : ""}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-auto overscroll-contain px-3 sm:px-5 py-4 space-y-5">
            {msgsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-3/4 rounded-2xl" />
                ))}
              </div>
            ) : !msgs?.length ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-sm font-medium text-foreground">{t("messages.noMessages")}</p>
                <p className="text-xs text-muted-foreground">{t("messages.noMessagesHint")}</p>
              </div>
            ) : (
              threadGroups.map((group) => (
                <div key={group.day} className="space-y-3">
                  <div className="flex justify-center">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      {group.day}
                    </span>
                  </div>
                  {group.items.map(({ message, sender }) => {
                    const mine = sender.id === user?.id;
                    const initials =
                      sender.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?";
                    return (
                      <div
                        key={message.id}
                        className={cn("flex gap-2.5", mine ? "flex-row-reverse" : "flex-row")}
                      >
                        {!mine ? (
                          <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/15 flex items-center justify-center shrink-0 text-[10px] font-semibold text-[var(--color-navy)] mt-0.5">
                            {initials}
                          </div>
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        <div
                          className={cn(
                            "max-w-[min(85%,28rem)] min-w-0",
                            mine ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-baseline gap-2 mb-1 px-0.5",
                              mine && "flex-row-reverse"
                            )}
                          >
                            <span className="text-xs font-medium text-foreground">
                              {mine ? t("messages.you") : sender.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(message.createdAt), "HH:mm")}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                              mine
                                ? "bg-[var(--color-navy)] text-white rounded-2xl rounded-tr-md"
                                : "bg-card border border-border text-foreground rounded-2xl rounded-tl-md"
                            )}
                          >
                            {message.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={threadEndRef} />
          </div>

          <div className="p-3 sm:p-4 border-t border-border bg-card shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-2 py-2 focus-within:ring-2 focus-within:ring-[var(--color-navy)]/30">
              <Textarea
                className="flex-1 resize-none min-h-[44px] max-h-32 border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 py-2"
                placeholder={t("messages.placeholder")}
                value={newMessage}
                rows={1}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                size="icon"
                className="rounded-xl shrink-0 bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white h-10 w-10"
                disabled={!newMessage.trim() || sendMsg.isPending}
                onClick={send}
                aria-label={t("messages.send")}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1 hidden sm:block">
              {t("messages.sendHint")}
            </p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppLayout title={t("messages.title")} breadcrumb={[{ label: t("messages.title") }]}>
      <div className="h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-4.5rem)] min-h-[22rem]">
        {/* Mobile: list OR thread */}
        <div className="md:hidden h-full">
          {mobileShowThread && selectedCase ? threadPane : conversationList}
        </div>
        {/* Desktop: split */}
        <div className="hidden md:grid h-full grid-cols-[minmax(16rem,20rem)_1fr]">
          {conversationList}
          {threadPane}
        </div>
      </div>
    </AppLayout>
  );
}
