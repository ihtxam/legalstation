import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, FileText, MessageSquare, Lock, Globe, Plus,
  Upload, Download, Eye, Trash2, Clock, Edit2, FolderOpen,
  AlertCircle
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { CASE_TYPE_LABELS } from "@shared/types";

function CaseTimeline({ caseId, isInternal }: { caseId: number; isInternal: boolean }) {
  const { data: events, isLoading, refetch } = trpc.cases.getEvents.useQuery({ caseId });
  const [showAdd, setShowAdd] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "shared">("internal");
  const addNote = trpc.cases.addNote.useMutation({
    onSuccess: () => { setNoteContent(""); setShowAdd(false); refetch(); toast.success("Note added"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteNote = trpc.cases.deleteNote.useMutation({
    onSuccess: () => { refetch(); toast.success("Note deleted"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {isInternal && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add note
          </Button>
        </div>
      )}
      {!events?.length ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No timeline events yet</div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {events.map(({ event, author }) => (
              <div key={event.id} className="flex gap-4 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  event.eventType === "system" ? "bg-muted border border-border" :
                  event.eventType === "status_change" ? "bg-blue-100 border border-blue-200" :
                  event.visibility === "internal" ? "bg-purple-100 border border-purple-200" :
                  "bg-teal-100 border border-teal-200"
                }`}>
                  {event.eventType === "system" ? <Clock className="w-3.5 h-3.5 text-muted-foreground" /> :
                   event.eventType === "status_change" ? <AlertCircle className="w-3.5 h-3.5 text-blue-600" /> :
                   event.visibility === "internal" ? <Lock className="w-3.5 h-3.5 text-purple-600" /> :
                   <Globe className="w-3.5 h-3.5 text-teal-600" />}
                </div>
                <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-4 shadow-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{event.title ?? event.eventType}</span>
                        {event.eventType === "note" && <StatusBadge status={event.visibility} />}
                      </div>
                      {event.content && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{event.content}</p>}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{author?.name ?? "System"}</span>
                        <span>·</span>
                        <span>{format(event.createdAt, "dd MMM yyyy, HH:mm")}</span>
                      </div>
                    </div>
                    {event.eventType === "note" && isInternal && (
                      <button onClick={() => deleteNote.mutate({ id: event.id, caseId })} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Note content</Label>
              <Textarea className="mt-1.5" rows={4} value={noteContent} onChange={e => setNoteContent(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={noteVisibility === "shared"} onCheckedChange={v => setNoteVisibility(v ? "shared" : "internal")} />
              <div>
                <p className="text-sm font-medium">{noteVisibility === "shared" ? "Shared with client" : "Internal only"}</p>
                <p className="text-xs text-muted-foreground">{noteVisibility === "shared" ? "Client can see this note" : "Only firm members can see this"}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!noteContent.trim() || addNote.isPending}
              onClick={() => addNote.mutate({ caseId, content: noteContent, visibility: noteVisibility })}>
              Add note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaseDocuments({ caseId, firmId }: { caseId: number; firmId: number }) {
  const { data: folders, refetch: refetchFolders } = trpc.documents.getFolders.useQuery({ caseId });
  const { data: docs, isLoading, refetch: refetchDocs } = trpc.documents.list.useQuery({ caseId });
  const [uploading, setUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createFolder = trpc.documents.createFolder.useMutation({
    onSuccess: () => { setNewFolderName(""); setShowNewFolder(false); refetchFolders(); toast.success("Folder created"); },
    onError: (e) => toast.error(e.message),
  });
  const registerDoc = trpc.documents.register.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document uploaded"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleVisibility = trpc.documents.updateVisibility.useMutation({
    onSuccess: () => refetchDocs(),
    onError: (e) => toast.error(e.message),
  });
  const logAccess = trpc.documents.logAccess.useMutation();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { key, url } = await res.json();
      await registerDoc.mutateAsync({
        caseId, folderId: selectedFolder ?? undefined,
        name: file.name, originalName: file.name,
        mimeType: file.type, size: file.size,
        fileKey: key, fileUrl: url, visibility: "internal",
      });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const groupedDocs = (folders ?? []).map(folder => ({
    folder,
    docs: (docs ?? []).filter(d => d.doc.folderId === folder.id),
  }));
  const unfoldered = (docs ?? []).filter(d => !d.doc.folderId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> New folder
          </Button>
          <Button size="sm" className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.xlsx,.xls" />
        </div>
      </div>

      {showNewFolder && (
        <div className="flex gap-2">
          <Input placeholder="Folder name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={() => createFolder.mutate({ caseId, name: newFolderName })} disabled={!newFolderName.trim()}>Create</Button>
          <Button size="sm" variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !docs?.length ? (
        <div className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDocs.map(({ folder, docs: fDocs }) => fDocs.length > 0 && (
            <div key={folder.id}>
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-4 h-4 text-[var(--color-gold)]" />
                <span className="text-sm font-semibold text-foreground">{folder.name}</span>
                <span className="text-xs text-muted-foreground">({fDocs.length})</span>
              </div>
              <DocList docs={fDocs} onToggle={toggleVisibility.mutate} onLog={logAccess.mutate} />
            </div>
          ))}
          {unfoldered.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">Unfiled</p>
              <DocList docs={unfoldered} onToggle={toggleVisibility.mutate} onLog={logAccess.mutate} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocList({ docs, onToggle, onLog }: { docs: any[]; onToggle: (v: any) => void; onLog: (v: any) => void }) {
  return (
    <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
      {docs.map(({ doc }) => (
        <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
            <p className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB · v{doc.currentVersion}</p>
          </div>
          <StatusBadge status={doc.visibility} />
          <div className="flex items-center gap-1">
            <button title="Toggle visibility" onClick={() => onToggle({ id: doc.id, visibility: doc.visibility === "internal" ? "shared" : "internal" })}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
              {doc.visibility === "internal" ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => onLog({ documentId: doc.id, action: "download" })}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id);
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: caseData, isLoading, refetch } = trpc.cases.get.useQuery({ id: caseId }, { enabled: isAuthenticated && !isNaN(caseId) });
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const updateCase = trpc.cases.update.useMutation({
    onSuccess: () => { setEditStatus(false); refetch(); toast.success("Case updated"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);
  useEffect(() => { if (caseData) setNewStatus(caseData.status); }, [caseData]);

  const isInternal = firmData && ["admin", "lawyer", "assistant"].includes(firmData.member.firmRole);

  if (isLoading) return <LexLayout title="Case"><div className="p-6"><Skeleton className="h-64 w-full" /></div></LexLayout>;
  if (!caseData) return <LexLayout title="Not Found"><div className="p-6 text-center text-muted-foreground">Case not found</div></LexLayout>;

  return (
    <LexLayout breadcrumb={[{ label: "Cases", href: "/cases" }, { label: caseData.title }]}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Case header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-xl font-semibold text-foreground">{caseData.title}</h2>
                <StatusBadge status={caseData.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {caseData.referenceNumber && <span>Ref: <span className="font-medium text-foreground">{caseData.referenceNumber}</span></span>}
                <span>Type: <span className="font-medium text-foreground">{CASE_TYPE_LABELS[caseData.type]}</span></span>
                {caseData.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline: <span className="font-medium text-foreground">{format(caseData.deadline, "dd MMM yyyy")}</span>
                  </span>
                )}
              </div>
              {caseData.description && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{caseData.description}</p>}
            </div>
            {isInternal && (
              <div className="flex items-center gap-2 shrink-0">
                {editStatus ? (
                  <div className="flex items-center gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["open","pending","closed","archived"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 bg-[var(--color-navy)] text-white" onClick={() => updateCase.mutate({ id: caseId, status: newStatus as any })}>Save</Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditStatus(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditStatus(true)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Change status
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline">
          <TabsList className="bg-muted">
            <TabsTrigger value="timeline"><Clock className="w-3.5 h-3.5 mr-1.5" />Timeline</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Documents</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Messages</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <CaseTimeline caseId={caseId} isInternal={!!isInternal} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <CaseDocuments caseId={caseId} firmId={firmData?.firm.id ?? 0} />
          </TabsContent>
          <TabsContent value="messages" className="mt-4">
            <CaseMessages caseId={caseId} />
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}

function CaseMessages({ caseId }: { caseId: number }) {
  const { data: msgs, refetch } = trpc.messages.list.useQuery({ caseId });
  const [newMessage, setNewMessage] = useState("");
  const sendMsg = trpc.messages.send.useMutation({
    onSuccess: () => { setNewMessage(""); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const markRead = trpc.messages.markRead.useMutation();
  useEffect(() => { if (msgs) msgs.forEach(m => markRead.mutate({ messageId: m.message.id })); }, [msgs]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-96 overflow-auto">
        {!msgs?.length ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No messages yet</div>
        ) : msgs.map(({ message, sender }) => (
          <div key={message.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center shrink-0 text-xs font-semibold text-[var(--color-navy)]">
              {sender.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{sender.name}</span>
                <span className="text-xs text-muted-foreground">{format(message.createdAt, "dd MMM, HH:mm")}</span>
              </div>
              <div className="bg-card border border-border rounded-xl rounded-tl-sm px-4 py-3 text-sm text-foreground">
                {message.content}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Textarea className="flex-1 resize-none h-10 min-h-0" placeholder="Type a message…" value={newMessage} onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (newMessage.trim()) sendMsg.mutate({ caseId, content: newMessage.trim() }); } }} />
        <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white shrink-0" disabled={!newMessage.trim() || sendMsg.isPending}
          onClick={() => sendMsg.mutate({ caseId, content: newMessage.trim() })}>
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
