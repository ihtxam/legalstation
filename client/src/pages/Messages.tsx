import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MessagesPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: cases, isLoading } = trpc.cases.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { data: msgs, refetch: refetchMsgs } = trpc.messages.list.useQuery(
    { caseId: selectedCaseId! },
    { enabled: selectedCaseId !== null }
  );
  const sendMsg = trpc.messages.send.useMutation({
    onSuccess: () => { setNewMessage(""); refetchMsgs(); },
    onError: (e) => toast.error(e.message),
  });
  const markRead = trpc.messages.markRead.useMutation();

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);
  useEffect(() => {
    if (cases?.length && !selectedCaseId) setSelectedCaseId(cases[0].id);
  }, [cases]);
  useEffect(() => {
    if (msgs) msgs.forEach(m => markRead.mutate({ messageId: m.message.id }));
  }, [msgs]);

  const selectedCase = cases?.find(c => c.id === selectedCaseId);

  return (
    <LexLayout title="Messages" breadcrumb={[{ label: "Messages" }]}>
      <div className="flex h-full" style={{ height: "calc(100vh - 65px)" }}>
        {/* Case list sidebar */}
        <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm text-foreground">Conversations</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !cases?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No cases yet</div>
            ) : (
              cases.map(c => (
                <button key={c.id} onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-border hover:bg-accent transition-colors ${selectedCaseId === c.id ? "bg-accent" : ""}`}>
                  <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedCase ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a case to view messages</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-border bg-card">
                <h3 className="font-semibold text-foreground">{selectedCase.title}</h3>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-4">
                {!msgs?.length ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No messages yet. Start the conversation.</div>
                ) : (
                  msgs.map(({ message, sender }) => (
                    <div key={message.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center shrink-0 text-xs font-semibold text-[var(--color-navy)]">
                        {sender.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground">{sender.name}</span>
                          <span className="text-xs text-muted-foreground">{format(message.createdAt, "dd MMM, HH:mm")}</span>
                        </div>
                        <div className="bg-card border border-border rounded-xl rounded-tl-sm px-4 py-3 text-sm text-foreground leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-3">
                  <Textarea
                    className="flex-1 resize-none min-h-0 h-10"
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim()) sendMsg.mutate({ caseId: selectedCaseId!, content: newMessage.trim() });
                      }
                    }}
                  />
                  <Button
                    className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white shrink-0"
                    disabled={!newMessage.trim() || sendMsg.isPending}
                    onClick={() => sendMsg.mutate({ caseId: selectedCaseId!, content: newMessage.trim() })}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </LexLayout>
  );
}
