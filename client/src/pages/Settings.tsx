import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Users, Send } from "lucide-react";

export default function SettingsPage() {
  const { isAuthenticated, loading } = useAuth();
  const { data: firmData, refetch } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const { data: members } = trpc.firm.members.useQuery(undefined, { enabled: isAuthenticated && !!firmData });
  const [firmForm, setFirmForm] = useState({ name: "", address: "", email: "", phone: "", vatNumber: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"lawyer" | "assistant">("lawyer");

  const updateFirm = trpc.firm.update.useMutation({
    onSuccess: () => { toast.success("Firm settings saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const invite = trpc.firm.invite.useMutation({
    onSuccess: () => { toast.success("Invitation sent!"); setInviteEmail(""); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);
  useEffect(() => {
    if (firmData?.firm) {
      setFirmForm({
        name: firmData.firm.name ?? "",
        address: firmData.firm.address ?? "",
        email: firmData.firm.email ?? "",
        phone: firmData.firm.phone ?? "",
        vatNumber: firmData.firm.vatNumber ?? "",
      });
    }
  }, [firmData]);

  return (
    <LexLayout title="Settings" breadcrumb={[{ label: "Settings" }]}>
      <div className="p-6 max-w-3xl mx-auto">
        <Tabs defaultValue="firm">
          <TabsList className="bg-muted mb-6">
            <TabsTrigger value="firm"><Building2 className="w-4 h-4 mr-1.5" />Firm</TabsTrigger>
            <TabsTrigger value="team"><Users className="w-4 h-4 mr-1.5" />Team</TabsTrigger>
          </TabsList>

          <TabsContent value="firm">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Firm Settings</h3>
              <div><Label>Firm name</Label><Input className="mt-1.5" value={firmForm.name} onChange={e => setFirmForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Address</Label><Input className="mt-1.5" value={firmForm.address} onChange={e => setFirmForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" className="mt-1.5" value={firmForm.email} onChange={e => setFirmForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input className="mt-1.5" value={firmForm.phone} onChange={e => setFirmForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>VAT/UID Number</Label><Input className="mt-1.5" placeholder="CHE-123.456.789 MWST" value={firmForm.vatNumber} onChange={e => setFirmForm(f => ({ ...f, vatNumber: e.target.value }))} /></div>
              <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={updateFirm.isPending}
                onClick={() => updateFirm.mutate({ name: firmForm.name, address: firmForm.address, email: firmForm.email || null, phone: firmForm.phone, vatNumber: firmForm.vatNumber || null })}>
                {updateFirm.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4">Invite Team Member</h3>
                <div className="flex gap-3">
                  <Input className="flex-1" placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  <select className="border border-input rounded-md px-3 text-sm bg-background" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                    <option value="lawyer">Lawyer</option>
                    <option value="assistant">Assistant</option>
                  </select>
                  <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white shrink-0" disabled={!inviteEmail || invite.isPending}
                    onClick={() => invite.mutate({ email: inviteEmail, role: inviteRole })}>
                    <Send className="w-4 h-4 mr-1.5" /> Invite
                  </Button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-muted/40">
                  <h3 className="font-semibold text-sm text-foreground">Team Members</h3>
                </div>
                {!members?.length ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No team members</div>
                ) : (
                  <div className="divide-y divide-border">
                    {members.map(({ member, user }) => (
                      <div key={member.id} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                          <p className="font-medium text-sm text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-navy)]/8 text-[var(--color-navy)] capitalize">{member.firmRole}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}

