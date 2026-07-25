import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Building2, Mail, Phone, MapPin, Edit2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id);
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: client, isLoading, refetch } = trpc.clients.get.useQuery({ id: clientId }, { enabled: isAuthenticated && !isNaN(clientId) });
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { toast.success("Client updated"); setEditing(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const inviteClient = trpc.firm.invite.useMutation({
    onSuccess: async (data) => {
      setInviteEmail("");
      if (data.emailSent) {
        toast.success("Invitation sent!");
        return;
      }
      try {
        if (data.inviteUrl && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(data.inviteUrl);
          toast.warning(
            `Email could not be sent${data.emailError ? `: ${data.emailError}` : ""}. Invite link copied to clipboard.`
          );
          return;
        }
      } catch {
        // fall through
      }
      toast.warning(
        `Invitation created but email failed${data.emailError ? `: ${data.emailError}` : ""}. Link: ${data.inviteUrl || ""}`
      );
    },
    onError: (e) => {
      const msg = e.message || "";
      toast.error(
        msg.includes("Invalid email") || msg.trim().startsWith("[")
          ? "Please enter a valid email address"
          : msg
      );
    },
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const displayName = client
    ? client.type === "company" ? (client.companyName ?? "Unnamed Company") : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Unnamed Client"
    : "";

  if (isLoading) return <LexLayout title="Client"><div className="p-6"><Skeleton className="h-64 w-full" /></div></LexLayout>;
  if (!client) return <LexLayout title="Not Found"><div className="p-6 text-center text-muted-foreground">Client not found</div></LexLayout>;

  return (
    <LexLayout breadcrumb={[{ label: "Clients", href: "/clients" }, { label: displayName }]}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Profile header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center">
                {client.type === "company" ? <Building2 className="w-7 h-7 text-[var(--color-navy)]" /> : <User className="w-7 h-7 text-[var(--color-navy)]" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{displayName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground text-sm capitalize">{client.type}</span>
                  <span className="text-muted-foreground">·</span>
                  <StatusBadge status={client.status} />
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-border">
            {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /><span>{client.email}</span></div>}
            {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /><span>{client.phone}</span></div>}
            {(client.address || client.city) && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{[client.address, client.city, client.postalCode].filter(Boolean).join(", ")}</span></div>}
          </div>
        </div>

        {/* Invite section */}
        {!client.userId && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="font-medium text-blue-800 mb-1">Invite client to portal</p>
            <p className="text-blue-700 text-sm mb-3">Send an invitation so this client can access their cases and documents.</p>
            <div className="space-y-2">
              <Label htmlFor="client-invite-email">Email address</Label>
              <div className="flex gap-2">
                <Input
                  id="client-invite-email"
                  type="email"
                  autoComplete="email"
                  className="bg-white"
                  placeholder="client@example.com"
                  value={inviteEmail || client.email || ""}
                  onChange={e => setInviteEmail(e.target.value)}
                />
                <Button
                  className="bg-blue-700 hover:bg-blue-800 text-white shrink-0"
                  disabled={!(inviteEmail || client.email)?.trim() || inviteClient.isPending}
                  onClick={() =>
                    inviteClient.mutate({
                      email: (inviteEmail || client.email || "").trim().toLowerCase(),
                      role: "client",
                      clientId,
                    })
                  }
                >
                  <Send className="w-4 h-4 mr-1.5" /> Send invite
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="details">
          <TabsList className="bg-muted">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-2 gap-4">
              {[
                { label: "Client since", value: format(client.createdAt, "dd MMMM yyyy") },
                { label: "Onboarding", value: client.onboardingCompletedAt ? format(client.onboardingCompletedAt, "dd MMM yyyy") : "Pending" },
                { label: "Terms accepted", value: client.termsAcceptedAt ? format(client.termsAcceptedAt, "dd MMM yyyy") : "Not yet" },
                { label: "Country", value: client.country ?? "Switzerland" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{client.notes ?? "No notes added."}</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}
