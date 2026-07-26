import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DocumentAuditDialogProps {
  documentId: number | null;
  documentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_LABELS: Record<string, string> = {
  view: "Viewed",
  download: "Downloaded",
  upload: "Uploaded",
  delete: "Deleted",
  version_upload: "New version",
};

export function DocumentAuditDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
}: DocumentAuditDialogProps) {
  const { data: entries, isLoading } = trpc.documents.getAuditLog.useQuery(
    { documentId: documentId! },
    { enabled: open && !!documentId }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Access audit log
          </DialogTitle>
        </DialogHeader>
        {documentName && (
          <p className="text-sm text-muted-foreground -mt-2 truncate">{documentName}</p>
        )}

        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !entries?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No access events yet</p>
        ) : (
          <div className="max-h-80 overflow-auto divide-y divide-border border border-border rounded-lg">
            {entries.map(({ log, user }) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <Badge variant="outline" className="shrink-0 text-xs">
                  {ACTION_LABELS[log.action] || log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name || user.email || "User"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                    {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
