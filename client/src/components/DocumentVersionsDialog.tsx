import { format } from "date-fns";
import { Download, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DocumentVersionsDialogProps {
  documentId: number | null;
  documentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (documentId: number) => void;
}

export function DocumentVersionsDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
  onDownload,
}: DocumentVersionsDialogProps) {
  const { data: versions, isLoading } = trpc.documents.getVersions.useQuery(
    { documentId: documentId! },
    { enabled: open && !!documentId }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Version history
          </DialogTitle>
        </DialogHeader>
        {documentName && (
          <p className="text-sm text-muted-foreground -mt-2 truncate">{documentName}</p>
        )}

        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !versions?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No versions recorded</p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {versions.map(({ version, uploader }, index) => (
              <div key={version.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">v{version.version}</p>
                    {index === 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(version.size / 1024).toFixed(1)} KB · {uploader.name || "Unknown"} ·{" "}
                    {format(new Date(version.createdAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <a
                  href={version.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => documentId && onDownload?.(documentId)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Download this version"
                >
                  <Download className="w-4 h-4" />
                </a>
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
