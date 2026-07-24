import { format } from "date-fns";
import { History, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentVersionHistory({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: versions, isLoading } = trpc.documents.getVersions.useQuery(
    { documentId: documentId! },
    { enabled: open && documentId != null }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" /> Version history
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !versions?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No versions yet</p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">Version {v.version}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(v.createdAt), "dd MMM yyyy HH:mm")} · {(v.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(v.fileUrl, "_blank")}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
