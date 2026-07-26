import { useEffect } from "react";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRoleGuard } from "@/hooks/useRoleGuard";

const ACTION_LABELS: Record<string, string> = {
  view: "Viewed",
  download: "Downloaded",
  upload: "Uploaded",
  delete: "Deleted",
  version_upload: "New version",
};

export default function AuditLogPage() {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useRoleGuard({ requireFirmMember: true, requireAdmin: true });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data: entries, isLoading } = trpc.documents.firmAuditLog.useQuery(
    { limit: 150 },
    { enabled: isAuthenticated && isAdmin }
  );

  return (
    <LexLayout
      breadcrumb={[{ label: "Settings", href: "/settings" }, { label: "Audit Log" }]}
      title="Document Audit Log"
    >
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ScrollText className="w-6 h-6" />
            Document Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Firm-wide record of document uploads, downloads, views, and deletions.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !entries?.length ? (
          <div className="py-16 text-center border border-dashed border-border rounded-xl">
            <ScrollText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No audit events yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {entries.map(({ log, user, document }) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5">
                <Badge variant="outline" className="w-fit text-xs shrink-0">
                  {ACTION_LABELS[log.action] || log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{document.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.name || user.email || "User"} ·{" "}
                    {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                    {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">Case #{document.caseId}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </LexLayout>
  );
}
