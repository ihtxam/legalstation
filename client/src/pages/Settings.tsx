import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Users, Send, Upload, X, Shield, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setAppLocale } from "@/i18n";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, user, refresh } = useAuth();
  const { data: firmData, refetch } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const { data: members } = trpc.firm.members.useQuery(undefined, { enabled: isAuthenticated && !!firmData });
  const [firmForm, setFirmForm] = useState({ name: "", address: "", email: "", phone: "", vatNumber: "", logoUrl: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"lawyer" | "assistant">("lawyer");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState({ name: "", address: "", email: "", phone: "", vatNumber: "", logoUrl: "" });
  const [totpSetup, setTotpSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [locale, setLocale] = useState<"en" | "fr" | "de">("en");

  const setupTotp = trpc.auth.setupTotp.useMutation({
    onSuccess: (data) => setTotpSetup({ qrDataUrl: data.qrDataUrl, secret: data.secret }),
    onError: (e) => toast.error(e.message),
  });
  const enableTotp = trpc.auth.enableTotp.useMutation({
    onSuccess: async () => {
      toast.success(t("twoFactor.enabled"));
      setTotpSetup(null);
      setTotpCode("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const disableTotp = trpc.auth.disableTotp.useMutation({
    onSuccess: async () => {
      toast.success("2FA disabled");
      setTotpCode("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: (r) => {
      setAppLocale(r.locale);
      toast.success("Language updated");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (user?.preferredLocale === "fr" || user?.preferredLocale === "de" || user?.preferredLocale === "en") {
      setLocale(user.preferredLocale);
    }
  }, [user?.preferredLocale]);

  const getFieldDirty = (field: string) => {
    return originalForm[field as keyof typeof originalForm] !== firmForm[field as keyof typeof firmForm];
  };

  const getFieldHighlight = (field: string) => {
    return getFieldDirty(field) ? 'border-blue-500 border-2' : '';
  };

  const updateFirm = trpc.firm.update.useMutation({
    onSuccess: () => { 
      toast.success("Firm settings saved"); 
      setOriginalForm(firmForm);
      setHasChanges(false);
      refetch(); 
    },
    onError: (e) => toast.error(e.message),
  });
  const invite = trpc.firm.invite.useMutation({
    onSuccess: () => { 
      toast.success("Invitation sent! Team member will receive an email with the join link."); 
      setInviteEmail(""); 
      setInviteRole("lawyer");
    },
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
        logoUrl: firmData.firm.logoUrl ?? "",
      });
      if (firmData.firm.logoUrl) setLogoPreview(firmData.firm.logoUrl);
      setOriginalForm({
        name: firmData.firm.name ?? "",
        address: firmData.firm.address ?? "",
        email: firmData.firm.email ?? "",
        phone: firmData.firm.phone ?? "",
        vatNumber: firmData.firm.vatNumber ?? "",
        logoUrl: firmData.firm.logoUrl ?? "",
      });
    }
  }, [firmData]);

  useEffect(() => {
    const changed = JSON.stringify(firmForm) !== JSON.stringify(originalForm);
    setHasChanges(changed);
  }, [firmForm, originalForm]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setLogoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
      setHasChanges(true);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setFirmForm(f => ({ ...f, logoUrl: data.url }));
        setLogoFile(null);
        setHasChanges(true);
        toast.success("Logo uploaded successfully");
      }
    } catch (e) {
      toast.error("Failed to upload logo");
    }
  };

  return (
    <LexLayout title="Settings" breadcrumb={[{ label: "Settings" }]}>
      <div className="p-6 max-w-3xl mx-auto">
        <Tabs defaultValue="firm">
          <TabsList className="bg-muted mb-6 flex flex-wrap h-auto">
            <TabsTrigger value="firm"><Building2 className="w-4 h-4 mr-1.5" />Firm</TabsTrigger>
            <TabsTrigger value="team"><Users className="w-4 h-4 mr-1.5" />Team</TabsTrigger>
            <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5" />Security</TabsTrigger>
            <TabsTrigger value="language"><Languages className="w-4 h-4 mr-1.5" />{t("common.language")}</TabsTrigger>
          </TabsList>

          <TabsContent value="firm">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Firm Settings</h3>
              <div><Label>Firm name</Label><Input className={`mt-1.5 ${getFieldHighlight('name')}`} value={firmForm.name} onChange={e => setFirmForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Address</Label><Input className={`mt-1.5 ${getFieldHighlight('address')}`} value={firmForm.address} onChange={e => setFirmForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" className={`mt-1.5 ${getFieldHighlight('email')}`} value={firmForm.email} onChange={e => setFirmForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input className={`mt-1.5 ${getFieldHighlight('phone')}`} value={firmForm.phone} onChange={e => setFirmForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>VAT/UID Number</Label><Input className={`mt-1.5 ${getFieldHighlight('vatNumber')}`} placeholder="CHE-123.456.789 MWST" value={firmForm.vatNumber} onChange={e => setFirmForm(f => ({ ...f, vatNumber: e.target.value }))} /></div>
              <div>
                <Label>Logo</Label>
                <div className="mt-1.5 flex gap-3 items-end">
                  <div className="flex-1">
                    {logoPreview ? (
                      <div className="relative w-24 h-24 bg-muted rounded-lg overflow-hidden border border-border flex items-center justify-center">
                        <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                        <button onClick={() => { setLogoPreview(""); setLogoFile(null); setFirmForm(f => ({ ...f, logoUrl: "" })); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/80">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      </label>
                    )}
                  </div>
                  {logoFile && <Button onClick={handleLogoUpload} className="bg-blue-600 hover:bg-blue-700 text-white">Upload</Button>}
                </div>
              </div>
              <Button className={`${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)]'} text-white`} disabled={updateFirm.isPending || !hasChanges}
                onClick={() => updateFirm.mutate({ name: firmForm.name, address: firmForm.address, email: firmForm.email || null, phone: firmForm.phone, vatNumber: firmForm.vatNumber || null, logoUrl: firmForm.logoUrl || null })}>
                {updateFirm.isPending ? "Saving…" : hasChanges ? "Save unsaved changes" : "No changes"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{t("twoFactor.title")}</h3>
              <p className="text-sm text-muted-foreground">
                Optional authenticator-app 2FA after Manus login.
              </p>
              {user?.totpEnabled ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-700">{t("twoFactor.enabled")}</p>
                  <Input
                    placeholder="Authenticator code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={totpCode.length < 6 || disableTotp.isPending}
                    onClick={() => disableTotp.mutate({ code: totpCode })}
                  >
                    {t("twoFactor.disable")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {!totpSetup ? (
                    <Button onClick={() => setupTotp.mutate()} disabled={setupTotp.isPending}>
                      {t("twoFactor.enable")}
                    </Button>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{t("twoFactor.setup")}</p>
                      <img src={totpSetup.qrDataUrl} alt="2FA QR" className="w-48 h-48 border rounded" />
                      <p className="text-xs font-mono break-all text-muted-foreground">{totpSetup.secret}</p>
                      <Input
                        placeholder="Authenticator code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                      />
                      <Button
                        disabled={totpCode.length < 6 || enableTotp.isPending}
                        onClick={() => enableTotp.mutate({ code: totpCode })}
                      >
                        {t("twoFactor.verify")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="language">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{t("common.language")}</h3>
              <Select value={locale} onValueChange={(v: "en" | "fr" | "de") => setLocale(v)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setLocaleMutation.mutate({ locale })}
                disabled={setLocaleMutation.isPending}
              >
                {t("common.save")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Invite Team Member</h3>
                  <p className="text-sm text-muted-foreground">Send an invitation email to add a new team member. They'll receive a link to join your firm.</p>
                </div>
                <div className="flex gap-3">
                  <Input className="flex-1" placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  <select className="border border-input rounded-md px-3 text-sm bg-background" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                    <option value="lawyer">Lawyer</option>
                    <option value="assistant">Assistant</option>
                  </select>
                  <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white shrink-0" disabled={!inviteEmail || invite.isPending}
                    onClick={() => invite.mutate({ email: inviteEmail, role: inviteRole })}>
                    {invite.isPending ? "Sending..." : <><Send className="w-4 h-4 mr-1.5" /> Invite</> }
                  </Button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-muted/40">
                  <h3 className="font-semibold text-sm text-foreground">Team Members ({members?.length ?? 0})</h3>
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

