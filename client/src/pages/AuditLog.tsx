import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import LexLayout from "@/components/LexLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

export default function AuditLogPage() {
  const { isAuthenticated, loading } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data, isLoading, refetch } = trpc.deployment.exportAuditLog.useQuery(
    {
      from: from || undefined,
      to: to || undefined,
      limit: 500,
    },
    { enabled: isAuthenticated }
  );

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexflow-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit export downloaded");
  };

  return (
    <LexLayout breadcrumb={[{ label: "Audit log" }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit log</h1>
          <p className="text-muted-foreground mt-1">
            Document access events for SIEM export and compliance review
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Admin-only firm-wide document audit trail</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>From</Label>
              <Input type="date" className="mt-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" className="mt-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void refetch()}>Apply</Button>
            <Button onClick={downloadJson} disabled={!data?.events?.length}>
              <Download className="w-4 h-4 mr-1.5" /> Export JSON
            </Button>
          </CardContent>
        </Card>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !data?.events?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit events in this range
                  </TableCell>
                </TableRow>
              ) : (
                data.events.map((e) => (
                  <TableRow key={e.event_id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(e.timestamp), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.event_type}</TableCell>
                    <TableCell className="text-sm">
                      {e.resource.name}
                      <span className="text-xs text-muted-foreground block">#{e.resource.id}</span>
                    </TableCell>
                    <TableCell className="text-sm">User #{e.actor_user_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.network.ip || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </LexLayout>
  );
}
