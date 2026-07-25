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
import { Building2, Users, Send, Upload, X, Shield, Languages, ShieldCheck } from "lucide-react";
import RolePermissionsTable from "@/components/RolePermissionsTable";
import { useTranslation } from "react-i18next";
import { setAppLocale } from "@/i18n";
import { APP_LOCALES, APP_LOCALE_LABELS, isAppLocale, type AppLocale } from "@shared/locales";
import CustomDomainDnsHelp from "@/components/CustomDomainDnsHelp";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_ALLOWED_UPLOAD_EXTENSIONS,
  DEFAULT_MAX_UPLOAD_BYTES,
  parseAllowedExtensions,
} from "@shared/uploadPolicy";
import { isFirmAdminLike } from "@shared/roles";

const UPLOAD_TYPE_OPTIONS = [...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS];

type InviteStaffRole = "subadmin" | "lawyer" | "assistant";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, user, refresh } = useAuth();
  const { data: firmData, refetch } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const canManageFirm = isFirmAdminLike(firmData?.member?.firmRole);
  const isOwnerAdmin = firmData?.member?.firmRole === "admin";
  const { data: members } = trpc.firm.members.useQuery(undefined, {
    enabled: isAuthenticated && canManageFirm,
  });
  const emptyFirmForm = {
    name: "",
    address: "",
    email: "",
    phone: "",
    vatNumber: "",
    logoUrl: "",
    iban: "",
    qrIban: "",
    creditorStreet: "",
    creditorBuildingNumber: "",
    creditorPostalCode: "",
    creditorCity: "",
    creditorCountry: "CH",
  };
  const [firmForm, setFirmForm] = useState(emptyFirmForm);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteStaffRole>("lawyer");
  const [inviteEmailLanguage, setInviteEmailLanguage] = useState<AppLocale>("en");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(emptyFirmForm);
  const [maxUploadMb, setMaxUploadMb] = useState("10");
  const [allowedTypes, setAllowedTypes] = useState<string[]>([...UPLOAD_TYPE_OPTIONS] as string[]);
  const [originalUpload, setOriginalUpload] = useState<{ maxUploadMb: string; allowedTypes: string[] }>({
    maxUploadMb: "10",
    allowedTypes: [...UPLOAD_TYPE_OPTIONS],
  });
  const [totpSetup, setTotpSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [locale, setLocale] = useState<AppLocale>("en");
  const isFirmAdmin = canManageFirm;

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
      toast.success(t("settings.totpDisabled"));
      setTotpCode("");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: (r) => {
      setAppLocale(r.locale);
      toast.success(t("settings.languageUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (isAppLocale(user?.preferredLocale)) {
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
      toast.success(t("settings.firmSaved"));
      setOriginalForm(firmForm);
      setOriginalUpload({ maxUploadMb, allowedTypes: [...allowedTypes] });
      setHasChanges(false);
      refetch(); 
    },
    onError: (e) => toast.error(e.message),
  });
  const invite = trpc.firm.invite.useMutation({
    onSuccess: async (data) => {
      setInviteEmail("");
      setInviteRole("lawyer");
      if (isAppLocale(user?.preferredLocale)) setInviteEmailLanguage(user.preferredLocale);
      if (data.emailSent) {
        toast.success(t("settings.inviteSent"));
        return;
      }
      const link = data.inviteUrl;
      try {
        if (link && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          toast.warning(
            data.emailError
              ? `${t("settings.inviteEmailFailed")}: ${data.emailError}. ${t("settings.inviteEmailFailedCopied")}`
              : t("settings.inviteEmailFailedCopied")
          );
          return;
        }
      } catch {
        // fall through
      }
      toast.warning(
        data.emailError
          ? `${t("settings.inviteEmailFailed")}: ${data.emailError}. ${link || ""}`
          : `${t("settings.inviteEmailFailed")}. ${link || ""}`
      );
    },
    onError: (e) => {
      const msg = e.message || "";
      // Zod 4 often surfaces the whole issue array as the message
      toast.error(
        msg.includes("Invalid email") || msg.trim().startsWith("[")
          ? t("settings.invalidEmail")
          : msg
      );
    },
  });

  const submitInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error(t("settings.invalidEmail"));
      return;
    }
    invite.mutate({ email, role: inviteRole, emailLanguage: inviteEmailLanguage });
  };

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);
  useEffect(() => {
    if (isAppLocale(user?.preferredLocale)) {
      setInviteEmailLanguage(user.preferredLocale);
    }
  }, [user?.preferredLocale]);
  useEffect(() => {
    if (firmData?.firm) {
      const next = {
        name: firmData.firm.name ?? "",
        address: firmData.firm.address ?? "",
        email: firmData.firm.email ?? "",
        phone: firmData.firm.phone ?? "",
        vatNumber: firmData.firm.vatNumber ?? "",
        logoUrl: firmData.firm.logoUrl ?? "",
        iban: firmData.firm.iban ?? "",
        qrIban: firmData.firm.qrIban ?? "",
        creditorStreet: firmData.firm.creditorStreet ?? "",
        creditorBuildingNumber: firmData.firm.creditorBuildingNumber ?? "",
        creditorPostalCode: firmData.firm.creditorPostalCode ?? "",
        creditorCity: firmData.firm.creditorCity ?? "",
        creditorCountry: firmData.firm.creditorCountry ?? "CH",
      };
      setFirmForm(next);
      if (firmData.firm.logoUrl) setLogoPreview(firmData.firm.logoUrl);
      setOriginalForm(next);
      const bytes = firmData.firm.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
      const mb = String(Math.round((bytes / (1024 * 1024)) * 10) / 10);
      const types = parseAllowedExtensions(firmData.firm.allowedUploadTypes);
      setMaxUploadMb(mb);
      setAllowedTypes(types);
      setOriginalUpload({ maxUploadMb: mb, allowedTypes: types });
    }
  }, [firmData]);

  useEffect(() => {
    const firmChanged = JSON.stringify(firmForm) !== JSON.stringify(originalForm);
    const uploadChanged =
      maxUploadMb !== originalUpload.maxUploadMb ||
      JSON.stringify([...allowedTypes].sort()) !== JSON.stringify([...originalUpload.allowedTypes].sort());
    setHasChanges(firmChanged || uploadChanged);
  }, [firmForm, originalForm, maxUploadMb, allowedTypes, originalUpload]);

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
      formData.append("purpose", "logo");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t("settings.logoUploadFailed"));
        return;
      }
      if (data.url) {
        setFirmForm((f) => ({ ...f, logoUrl: data.url }));
        setLogoFile(null);
        setHasChanges(true);
        toast.success(t("settings.logoUploaded"));
      }
    } catch {
      toast.error(t("settings.logoUploadFailed"));
    }
  };

  const toggleUploadType = (ext: string, checked: boolean) => {
    setAllowedTypes((prev) => {
      if (checked) return prev.includes(ext) ? prev : [...prev, ext];
      return prev.filter((x) => x !== ext);
    });
  };

  return (
    <LexLayout title={t("settings.title")} breadcrumb={[{ label: t("settings.title") }]}>
      <div className="p-6 max-w-5xl mx-auto">
        <Tabs defaultValue={canManageFirm ? "firm" : "language"}>
          <TabsList className="bg-muted mb-6 flex flex-wrap h-auto">
            {canManageFirm && (
              <>
                <TabsTrigger value="firm"><Building2 className="w-4 h-4 mr-1.5" />{t("settings.tabFirm")}</TabsTrigger>
                <TabsTrigger value="team"><Users className="w-4 h-4 mr-1.5" />{t("settings.tabTeam")}</TabsTrigger>
                <TabsTrigger value="roles"><ShieldCheck className="w-4 h-4 mr-1.5" />{t("settings.tabRoles")}</TabsTrigger>
              </>
            )}
            <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5" />{t("settings.tabSecurity")}</TabsTrigger>
            <TabsTrigger value="language"><Languages className="w-4 h-4 mr-1.5" />{t("settings.tabLanguage")}</TabsTrigger>
          </TabsList>

          {canManageFirm && <TabsContent value="firm">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{t("settings.firmSettings")}</h3>
              <div><Label>{t("settings.firmName")}</Label><Input className={`mt-1.5 ${getFieldHighlight('name')}`} value={firmForm.name} onChange={e => setFirmForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{t("settings.address")}</Label><Input className={`mt-1.5 ${getFieldHighlight('address')}`} value={firmForm.address} onChange={e => setFirmForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("settings.email")}</Label><Input type="email" className={`mt-1.5 ${getFieldHighlight('email')}`} value={firmForm.email} onChange={e => setFirmForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>{t("settings.phone")}</Label><Input className={`mt-1.5 ${getFieldHighlight('phone')}`} value={firmForm.phone} onChange={e => setFirmForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>{t("settings.vatNumber")}</Label><Input className={`mt-1.5 ${getFieldHighlight('vatNumber')}`} placeholder="CHE-123.456.789 MWST" value={firmForm.vatNumber} onChange={e => setFirmForm(f => ({ ...f, vatNumber: e.target.value }))} /></div>
              <div>
                <Label>{t("settings.logo")}</Label>
                <div className="mt-1.5 flex gap-3 items-end">
                  <div className="flex-1">
                    {logoPreview ? (
                      <div className="relative w-24 h-24 bg-muted rounded-lg overflow-hidden border border-border flex items-center justify-center">
                        <img src={logoPreview} alt={t("settings.logoPreview")} className="max-w-full max-h-full object-contain" />
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
                  {logoFile && <Button onClick={handleLogoUpload} className="bg-blue-600 hover:bg-blue-700 text-white">{t("docs.upload")}</Button>}
                </div>
              </div>
              {isFirmAdmin && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{t("settings.bankingTitle")}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{t("settings.bankingHint")}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firm-iban">{t("settings.iban")}</Label>
                      <Input
                        id="firm-iban"
                        className={`mt-1.5 ${getFieldHighlight("iban")}`}
                        placeholder="CH93 0076 2011 6238 5295 7"
                        value={firmForm.iban}
                        onChange={(e) => setFirmForm((f) => ({ ...f, iban: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="firm-qr-iban">{t("settings.qrIban")}</Label>
                      <Input
                        id="firm-qr-iban"
                        className={`mt-1.5 ${getFieldHighlight("qrIban")}`}
                        placeholder="CH44 3199 9123 0008 8901 2"
                        value={firmForm.qrIban}
                        onChange={(e) => setFirmForm((f) => ({ ...f, qrIban: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("settings.qrIbanHelp")}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="creditor-street">{t("settings.creditorStreet")}</Label>
                      <Input
                        id="creditor-street"
                        className={`mt-1.5 ${getFieldHighlight("creditorStreet")}`}
                        value={firmForm.creditorStreet}
                        onChange={(e) => setFirmForm((f) => ({ ...f, creditorStreet: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="creditor-building">{t("settings.creditorBuildingNumber")}</Label>
                      <Input
                        id="creditor-building"
                        className={`mt-1.5 ${getFieldHighlight("creditorBuildingNumber")}`}
                        value={firmForm.creditorBuildingNumber}
                        onChange={(e) => setFirmForm((f) => ({ ...f, creditorBuildingNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="creditor-zip">{t("settings.creditorPostalCode")}</Label>
                      <Input
                        id="creditor-zip"
                        className={`mt-1.5 ${getFieldHighlight("creditorPostalCode")}`}
                        value={firmForm.creditorPostalCode}
                        onChange={(e) => setFirmForm((f) => ({ ...f, creditorPostalCode: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="creditor-city">{t("settings.creditorCity")}</Label>
                      <Input
                        id="creditor-city"
                        className={`mt-1.5 ${getFieldHighlight("creditorCity")}`}
                        value={firmForm.creditorCity}
                        onChange={(e) => setFirmForm((f) => ({ ...f, creditorCity: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="creditor-country">{t("settings.creditorCountry")}</Label>
                      <Input
                        id="creditor-country"
                        className={`mt-1.5 ${getFieldHighlight("creditorCountry")}`}
                        maxLength={2}
                        placeholder="CH"
                        value={firmForm.creditorCountry}
                        onChange={(e) => setFirmForm((f) => ({ ...f, creditorCountry: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                </div>
              )}
              {isFirmAdmin && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{t("settings.uploadPolicyTitle")}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{t("settings.uploadPolicyHint")}</p>
                  </div>
                  <div>
                    <Label htmlFor="maxUploadMb">{t("settings.maxUploadMb")}</Label>
                    <Input
                      id="maxUploadMb"
                      type="number"
                      min={0.1}
                      max={50}
                      step={0.1}
                      className="mt-1.5 max-w-[180px]"
                      value={maxUploadMb}
                      onChange={(e) => setMaxUploadMb(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t("settings.maxUploadMbHelp")}</p>
                  </div>
                  <div>
                    <Label>{t("settings.allowedFileTypes")}</Label>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {UPLOAD_TYPE_OPTIONS.map((ext) => (
                        <label key={ext} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={allowedTypes.includes(ext)}
                            onCheckedChange={(c) => toggleUploadType(ext, Boolean(c))}
                          />
                          <span className="uppercase">{ext}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <Button
                className={`${hasChanges ? "bg-blue-600 hover:bg-blue-700" : "bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)]"} text-white`}
                disabled={updateFirm.isPending || !hasChanges || (isFirmAdmin && allowedTypes.length === 0)}
                onClick={() => {
                  const mb = parseFloat(maxUploadMb);
                  if (isFirmAdmin && (!(mb > 0) || mb > 50)) {
                    toast.error(t("settings.maxUploadMbHelp"));
                    return;
                  }
                  if (isFirmAdmin && allowedTypes.length === 0) {
                    toast.error(t("settings.allowedFileTypesRequired"));
                    return;
                  }
                  updateFirm.mutate({
                    name: firmForm.name,
                    address: firmForm.address,
                    email: firmForm.email || null,
                    phone: firmForm.phone,
                    vatNumber: firmForm.vatNumber || null,
                    logoUrl: firmForm.logoUrl || null,
                    ...(isFirmAdmin
                      ? {
                          maxUploadMb: mb,
                          allowedUploadTypes: allowedTypes,
                          iban: firmForm.iban || null,
                          qrIban: firmForm.qrIban || null,
                          creditorStreet: firmForm.creditorStreet || null,
                          creditorBuildingNumber: firmForm.creditorBuildingNumber || null,
                          creditorPostalCode: firmForm.creditorPostalCode || null,
                          creditorCity: firmForm.creditorCity || null,
                          creditorCountry: firmForm.creditorCountry || "CH",
                        }
                      : {}),
                  });
                }}
              >
                {updateFirm.isPending
                  ? t("settings.saving")
                  : hasChanges
                    ? t("settings.saveUnsavedChanges")
                    : t("settings.noChanges")}
              </Button>
              {firmData?.firm && (
                <CustomDomainDnsHelp
                  customDomain={firmData.firm.customDomain}
                  subdomainStatus={firmData.firm.subdomainStatus}
                  slug={firmData.firm.slug}
                />
              )}
            </div>
          </TabsContent>}

          <TabsContent value="security">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{t("twoFactor.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.securityHint")}
              </p>
              {user?.totpEnabled ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-700">{t("twoFactor.enabled")}</p>
                  <Input
                    placeholder={t("settings.authenticatorCode")}
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
                        placeholder={t("settings.authenticatorCode")}
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
              <div>
                <h3 className="font-semibold text-foreground">{t("settings.languageHeading")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("settings.languageHint")}</p>
              </div>
              <Select value={locale} onValueChange={(v) => setLocale(v as AppLocale)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_LOCALES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {APP_LOCALE_LABELS[code]}
                    </SelectItem>
                  ))}
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

          {canManageFirm && <TabsContent value="team">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{t("settings.inviteMember")}</h3>
                  <p className="text-sm text-muted-foreground">{t("settings.inviteHint")}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="invite-email">{t("settings.inviteEmail")}</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      autoComplete="email"
                      className="mt-1.5"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") submitInvite(); }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="invite-role">{t("settings.inviteRole")}</Label>
                      <select
                        id="invite-role"
                        className="mt-1.5 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as InviteStaffRole)}
                      >
                        {isOwnerAdmin && <option value="subadmin">{t("settings.subadmin")}</option>}
                        <option value="lawyer">{t("settings.lawyer")}</option>
                        <option value="assistant">{t("settings.assistant")}</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {inviteRole === "subadmin"
                          ? t("settings.roleHintSubadmin")
                          : inviteRole === "lawyer"
                            ? t("settings.roleHintLawyer")
                            : t("settings.roleHintAssistant")}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="invite-email-lang">{t("settings.inviteEmailLanguage")}</Label>
                      <Select
                        value={inviteEmailLanguage}
                        onValueChange={(v) => setInviteEmailLanguage(v as AppLocale)}
                      >
                        <SelectTrigger id="invite-email-lang" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_LOCALES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {APP_LOCALE_LABELS[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">{t("settings.inviteEmailLanguageHint")}</p>
                    </div>
                  </div>
                  <Button
                    className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                    disabled={!inviteEmail.trim() || invite.isPending}
                    onClick={submitInvite}
                  >
                    {invite.isPending ? t("settings.sending") : <><Send className="w-4 h-4 mr-1.5" /> {t("settings.sendInvite")}</>}
                  </Button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-muted/40">
                  <h3 className="font-semibold text-sm text-foreground">{t("settings.teamMembers", { count: members?.length ?? 0 })}</h3>
                </div>
                {!members?.length ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">{t("settings.noTeamMembers")}</div>
                ) : (
                  <div className="divide-y divide-border">
                    {members.map(({ member, user: memberUser }) => (
                      <div key={member.id} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                          <p className="font-medium text-sm text-foreground">{memberUser.name}</p>
                          <p className="text-xs text-muted-foreground">{memberUser.email}</p>
                        </div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-navy)]/8 text-[var(--color-navy)] capitalize">
                          {member.firmRole === "subadmin"
                            ? t("settings.subadmin")
                            : member.firmRole === "admin"
                              ? t("roles.admin")
                              : member.firmRole === "lawyer"
                                ? t("settings.lawyer")
                                : t("settings.assistant")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>}

          {canManageFirm && (
            <TabsContent value="roles">
              <div className="bg-card border border-border rounded-xl p-6">
                <RolePermissionsTable />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </LexLayout>
  );
}

