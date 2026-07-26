import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { User, Building2, Mail, Phone, MapPin, Edit2, Send, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import ClientActivityPanel from "@/components/ClientActivityPanel";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_LOCALE_LABELS, isAppLocale, type AppLocale } from "@shared/locales";
import { useSupportedLocales } from "@/hooks/useSupportedLocales";

type ClientEditForm = {
  firstName: string;
  lastName: string;
  companyName: string;
  contactPerson: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  notes: string;
  status: "invited" | "active" | "inactive";
};

function emptyClientEditForm(): ClientEditForm {
  return {
    firstName: "",
    lastName: "",
    companyName: "",
    contactPerson: "",
    registrationNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
    notes: "",
    status: "active",
  };
}
export default function ClientDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id);
  const { isAuthenticated, loading, user } = useAuth();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ClientEditForm>(emptyClientEditForm());
  const [inviteEmail, setInviteEmail] = useState("");
  const { supportedLocales, defaultLocale, isEnabled } = useSupportedLocales();
  const [inviteEmailLanguage, setInviteEmailLanguage] = useState<AppLocale>(
    isAppLocale(i18n.language) ? i18n.language : "en"
  );
  const canSendClientInvite = Boolean(firmData?.capabilities?.canInviteClients);

  const { data: client, isLoading, refetch } = trpc.clients.get.useQuery({ id: clientId }, { enabled: isAuthenticated && !isNaN(clientId) });
  const canManageFirm = Boolean(firmData?.capabilities?.canManageFirmSettings);
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { toast.success(t("clients.updated")); setEditing(false); refetch(); },
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
  useEffect(() => {
    if (isAppLocale(user?.preferredLocale) && isEnabled(user.preferredLocale)) {
      setInviteEmailLanguage(user.preferredLocale);
    } else if (isAppLocale(i18n.language) && isEnabled(i18n.language)) {
      setInviteEmailLanguage(i18n.language);
    } else {
      setInviteEmailLanguage(defaultLocale);
    }
  }, [user?.preferredLocale, i18n.language, defaultLocale, isEnabled, supportedLocales]);

  const displayName = client
    ? client.type === "company" ? (client.companyName ?? "Unnamed Company") : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Unnamed Client"
    : "";

  const startEditing = () => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      companyName: client.companyName ?? "",
      contactPerson: client.contactPerson ?? "",
      registrationNumber: client.registrationNumber ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      postalCode: client.postalCode ?? "",
      country: client.country ?? "",
      notes: client.notes ?? "",
      status: client.status,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (client?.type === "individual" && !editForm.firstName.trim() && !editForm.lastName.trim()) {
      toast.error(t("caseDetail.clientNameRequired"));
      return;
    }
    if (client?.type === "company" && !editForm.companyName.trim()) {
      toast.error(t("caseDetail.companyNameRequired"));
      return;
    }
    updateClient.mutate({
      id: clientId,
      firstName: editForm.firstName.trim() || undefined,
      lastName: editForm.lastName.trim() || undefined,
      companyName: editForm.companyName.trim() || undefined,
      contactPerson: editForm.contactPerson.trim() || undefined,
      registrationNumber: editForm.registrationNumber.trim() || undefined,
      email: editForm.email.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      address: editForm.address.trim() || undefined,
      city: editForm.city.trim() || undefined,
      postalCode: editForm.postalCode.trim() || undefined,
      country: editForm.country.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
      status: canManageFirm ? editForm.status : undefined,
    });
  };

  if (isLoading) return <AppLayout title="Client"><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  if (!client) return <AppLayout title="Not Found"><div className="p-6 text-center text-muted-foreground">Client not found</div></AppLayout>;

  return (
    <AppLayout breadcrumb={[{ label: "Clients", href: "/clients" }, { label: displayName }]}>
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
            {editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5 mr-1.5" /> {t("common.cancel")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> {t("common.edit")}
              </Button>
            )}
          </div>

          {editing ? (
            <div className="mt-6 pt-5 border-t border-border space-y-4">
              {client.type === "individual" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{t("clients.firstName")}</Label>
                    <Input
                      className="mt-1.5"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t("clients.lastName")}</Label>
                    <Input
                      className="mt-1.5"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{t("clients.companyName")}</Label>
                    <Input
                      className="mt-1.5"
                      value={editForm.companyName}
                      onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t("clients.contactPerson")}</Label>
                    <Input
                      className="mt-1.5"
                      value={editForm.contactPerson}
                      onChange={(e) => setEditForm((f) => ({ ...f, contactPerson: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("clients.email")}</Label>
                  <Input
                    type="email"
                    className="mt-1.5"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("clients.phone")}</Label>
                  <Input
                    className="mt-1.5"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t("clients.address")}</Label>
                <Input
                  className="mt-1.5"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>{t("clients.city")}</Label>
                  <Input
                    className="mt-1.5"
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("clients.postalCode")}</Label>
                  <Input
                    className="mt-1.5"
                    value={editForm.postalCode}
                    onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("clients.country")}</Label>
                  <Input
                    className="mt-1.5"
                    value={editForm.country}
                    onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </div>
              </div>
              {canManageFirm && (
                <div className="sm:w-56">
                  <Label>{t("common.status")}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v: "invited" | "active" | "inactive") =>
                      setEditForm((f) => ({ ...f, status: v }))
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invited">{t("common.invited")}</SelectItem>
                      <SelectItem value="active">{t("common.active")}</SelectItem>
                      <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>{t("common.notes")}</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                  disabled={updateClient.isPending}
                  onClick={saveEdit}
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  {updateClient.isPending ? t("settings.saving") : t("common.save")}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-border">
              {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /><span>{client.email}</span></div>}
              {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /><span>{client.phone}</span></div>}
              {(client.address || client.city) && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{[client.address, client.city, client.postalCode].filter(Boolean).join(", ")}</span></div>}
            </div>
          )}
        </div>

        {/* Invite section */}
        {!client.userId && canSendClientInvite && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="font-medium text-blue-800 mb-1">{t("settings.inviteClientTitle")}</p>
            <p className="text-blue-700 text-sm mb-3">{t("settings.inviteClientHint")}</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="client-invite-email">{t("settings.inviteEmail")}</Label>
                <Input
                  id="client-invite-email"
                  type="email"
                  autoComplete="email"
                  className="bg-background mt-1.5"
                  placeholder="client@example.com"
                  value={inviteEmail || client.email || ""}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="client-invite-lang">{t("settings.inviteEmailLanguage")}</Label>
                <Select
                  value={inviteEmailLanguage}
                  onValueChange={(v) => setInviteEmailLanguage(v as AppLocale)}
                >
                  <SelectTrigger id="client-invite-lang" className="bg-background mt-1.5 max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLocales.map((code) => (
                      <SelectItem key={code} value={code}>
                        {APP_LOCALE_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-blue-700/80 mt-1">{t("settings.inviteEmailLanguageHint")}</p>
              </div>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                disabled={!(inviteEmail || client.email)?.trim() || inviteClient.isPending}
                onClick={() =>
                  inviteClient.mutate({
                    email: (inviteEmail || client.email || "").trim().toLowerCase(),
                    role: "client",
                    clientId,
                    emailLanguage: inviteEmailLanguage,
                  })
                }
              >
                <Send className="w-4 h-4 mr-1.5" /> {t("settings.sendInvite")}
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList className="bg-muted">
            <TabsTrigger value="activity">{t("crm.activityTitle")}</TabsTrigger>
            <TabsTrigger value="details">{t("common.details")}</TabsTrigger>
            <TabsTrigger value="notes">{t("common.notes")}</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="mt-4">
            <ClientActivityPanel clientId={clientId} />
          </TabsContent>
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
    </AppLayout>
  );
}
