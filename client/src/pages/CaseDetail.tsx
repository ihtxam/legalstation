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
  AlertCircle, Users, X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { CASE_TYPE_LABELS } from "@shared/types";
import { DocumentVersionHistory } from "@/components/DocumentVersionHistory";
import CaseTimePanel from "@/components/CaseTimePanel";

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
            <Input placeholder="Title (optional)" />
            <Textarea placeholder="Note content..." value={noteContent} onChange={e => setNoteContent(e.target.value)} />
            <div className="flex items-center justify-between">
              <Label>Visibility</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${noteVisibility === "internal" ? "text-purple-600" : "text-teal-600"}`}>
                  {noteVisibility === "internal" ? "Internal only" : "Shared with client"}
                </span>
                <Switch checked={noteVisibility === "shared"} onCheckedChange={v => setNoteVisibility(v ? "shared" : "internal")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!noteContent.trim() || addNote.isPending}
              onClick={() => addNote.mutate({ caseId, content: noteContent.trim(), visibility: noteVisibility })}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaseDocuments({ caseId, firmId }: { caseId: number; firmId: number }) {
  const { data: docs, isLoading, refetch } = trpc.documents.list.useQuery({ caseId });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const updateVisibility = trpc.documents.updateVisibility.useMutation({ onSuccess: () => refetch() });
  const logAccess = trpc.documents.logAccess.useMutation();
  const analyzeDocument = trpc.documentAnalysis.analyzeDocument.useMutation({
    onSuccess: () => toast.success("Document analysis complete"),
    onError: (e) => toast.error(e.message || "Analysis failed"),
  });
  const register = trpc.documents.register.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const groupedDocs = (docs ?? []).reduce((acc: any[], item: any) => {
    const folder = acc.find(g => g.folder.id === item.doc?.folderId);
    if (folder) folder.docs.push(item);
    else acc.push({ folder: { id: item.doc?.folderId || 0, name: "Uncategorized" }, docs: [item] });
    return acc;
  }, [] as any[]);
  const unfoldered = groupedDocs.find(g => g.folder.id === 0)?.docs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Document
        </Button>
      </div>
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
              <DocList docs={fDocs} onToggle={updateVisibility.mutate} onLog={logAccess.mutate} />
            </div>
          ))}
          {unfoldered.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">Unfiled</p>
              <DocList docs={unfoldered} onToggle={updateVisibility.mutate} onLog={logAccess.mutate} />
            </div>
          )}
        </div>
      )}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              {selectedFile ? selectedFile.name : "Choose file"}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button disabled={!selectedFile || register.isPending}
              onClick={async () => {
                if (!selectedFile) return;
                const file = selectedFile;
                const formData = new FormData();
                formData.append('file', file);
                formData.append('caseId', caseId.toString());
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const { fileKey, fileUrl } = await res.json();
                const result = await register.mutateAsync({
                  caseId,
                  name: file.name,
                  originalName: file.name,
                  mimeType: file.type,
                  size: file.size,
                  fileKey,
                  fileUrl,
                  folderId: folderId ? parseInt(folderId) : undefined,
                });
                setShowUpload(false);
                setSelectedFile(null);
                refetch();
                toast.success("Document uploaded");
                if (result.documentId) {
                  toast.loading("Analyzing document…", { id: "doc-analysis" });
                  analyzeDocument.mutate(
                    {
                      documentId: result.documentId,
                      documentUrl: fileUrl,
                      fileName: file.name,
                      mimeType: file.type || "application/octet-stream",
                    },
                    { onSettled: () => toast.dismiss("doc-analysis") }
                  );
                }
              }}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocList({ docs, onToggle, onLog }: { docs: any[]; onToggle: (v: any) => void; onLog: (v: any) => void }) {
  const [versionDocId, setVersionDocId] = useState<number | null>(null);
  return (
    <>
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
              <button title="Version history" onClick={() => setVersionDocId(doc.id)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors text-xs underline">
                History
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
      <DocumentVersionHistory
        documentId={versionDocId}
        open={versionDocId != null}
        onOpenChange={(open) => { if (!open) setVersionDocId(null); }}
      />
    </>
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

function CaseAssignments({ caseId }: { caseId: number }) {
  const { data: options, refetch } = trpc.cases.getAssignmentOptions.useQuery({ caseId });
  const [showAddLawyer, setShowAddLawyer] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  
  const assignLawyer = trpc.cases.assignLawyer.useMutation({
    onSuccess: () => { setSelectedLawyer(""); setShowAddLawyer(false); refetch(); toast.success("Lawyer assigned"); },
    onError: (e) => toast.error(e.message),
  });
  const assignClient = trpc.cases.assignClient.useMutation({
    onSuccess: () => { setSelectedClient(""); setShowAddClient(false); refetch(); toast.success("Client assigned"); },
    onError: (e) => toast.error(e.message),
  });
  const removeLawyer = trpc.cases.removeLawyer.useMutation({
    onSuccess: () => { refetch(); toast.success("Lawyer removed"); },
    onError: (e) => toast.error(e.message),
  });
  const removeClient = trpc.cases.removeClient.useMutation({
    onSuccess: () => { refetch(); toast.success("Client removed"); },
    onError: (e) => toast.error(e.message),
  });

  if (!options) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const lawyerAssignments = options.currentAssignments.filter(a => a.assignmentType === "lawyer");
  const clientAssignments = options.currentAssignments.filter(a => a.assignmentType === "client");

  return (
    <div className="space-y-6">
      {/* Lawyers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Assigned Lawyers</h3>
          <Button size="sm" className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => setShowAddLawyer(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add lawyer
          </Button>
        </div>
        {lawyerAssignments.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">No lawyers assigned</div>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {lawyerAssignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-foreground">
                  {(a as any).displayName || `User #${a.userId}`}
                </span>
                <button onClick={() => removeLawyer.mutate({ caseId, lawyerId: a.userId! })} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Dialog open={showAddLawyer} onOpenChange={setShowAddLawyer}>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Lawyer</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
                <SelectTrigger><SelectValue placeholder="Select a lawyer" /></SelectTrigger>
                <SelectContent>
                  {options.availableLawyers.map(l => (
                    <SelectItem key={l.member.id} value={l.member.userId.toString()}>
                      {l.user.name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddLawyer(false)}>Cancel</Button>
              <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!selectedLawyer || assignLawyer.isPending}
                onClick={() => assignLawyer.mutate({ caseId, lawyerId: parseInt(selectedLawyer) })}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Assigned Clients</h3>
          <Button size="sm" className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => setShowAddClient(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add client
          </Button>
        </div>
        {clientAssignments.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">No clients assigned</div>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {clientAssignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-foreground">
                  {(a as any).displayName || `Client #${a.clientId}`}
                </span>
                <button onClick={() => removeClient.mutate({ caseId, clientId: a.clientId! })} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Client</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {options.availableClients.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.companyName || `${c.firstName} ${c.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddClient(false)}>Cancel</Button>
              <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!selectedClient || assignClient.isPending}
                onClick={() => assignClient.mutate({ caseId, clientId: parseInt(selectedClient) })}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
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
            </div>
            {isInternal && (
              <Button size="sm" variant="outline" onClick={() => setEditStatus(true)}>
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Edit dialog */}
        <Dialog open={editStatus} onOpenChange={setEditStatus}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Case Status</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditStatus(false)}>Cancel</Button>
              <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={newStatus === caseData.status || updateCase.isPending}
                onClick={() => updateCase.mutate({ id: caseId, status: newStatus as any })}>
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="bg-card border border-border rounded-xl p-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="timeline"><Clock className="w-3.5 h-3.5 mr-1.5" />Timeline</TabsTrigger>
            <TabsTrigger value="time"><Clock className="w-3.5 h-3.5 mr-1.5" />Time</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Documents</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Messages</TabsTrigger>
            <TabsTrigger value="assignments"><Users className="w-3.5 h-3.5 mr-1.5" />Assignments</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <CaseTimeline caseId={caseId} isInternal={!!isInternal} />
          </TabsContent>
          <TabsContent value="time" className="mt-4">
            {isInternal ? (
              <CaseTimePanel caseId={caseId} />
            ) : (
              <div className="text-center text-muted-foreground py-8">Time tracking is available to firm staff only</div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <CaseDocuments caseId={caseId} firmId={firmData?.firm.id ?? 0} />
          </TabsContent>
          <TabsContent value="messages" className="mt-4">
            <CaseMessages caseId={caseId} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            {isInternal ? <CaseAssignments caseId={caseId} /> : <div className="text-center text-muted-foreground py-8">Only lawyers can manage assignments</div>}
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}
