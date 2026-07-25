import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { setAppLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Pause,
  Search,
  X,
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  Mail,
  CheckCircle2,
  Settings,
  Languages,
  Shield,
  Activity,
  RotateCcw,
  Save,
  AlertTriangle,
  LogOut,
} from "lucide-react";

type TabId = "overview" | "firms" | "plans" | "users" | "settings" | "audit";

export default function SuperadminDashboard() {
  const { user, logout, loading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>("overview");
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showEditFirm, setShowEditFirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedFirmId, setSelectedFirmId] = useState<number | null>(null);
  const [createPlanId, setCreatePlanId] = useState("");
  const [createBilling, setCreateBilling] = useState<"monthly" | "yearly">("monthly");
  const [sendCredentials, setSendCredentials] = useState(true);
  const [lastCreatedCreds, setLastCreatedCreds] = useState<{
    loginUrl: string;
    temporaryPassword?: string;
  } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [uiLocale, setUiLocale] = useState<"en" | "fr" | "de">("en");

  // Platform settings form state
  const [agencyName, setAgencyName] = useState("LexFlow");
  const [logoUrl, setLogoUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "fr" | "de">("en");
  const [localeEn, setLocaleEn] = useState(true);
  const [localeFr, setLocaleFr] = useState(true);
  const [localeDe, setLocaleDe] = useState(true);
  const [vatStandard, setVatStandard] = useState("8.1");
  const [vatReduced, setVatReduced] = useState("2.6");
  const [vatSpecial, setVatSpecial] = useState("3.8");
  const [vatZero, setVatZero] = useState("0");
  const [adyenApiKey, setAdyenApiKey] = useState("");
  const [adyenMerchant, setAdyenMerchant] = useState("");
  const [adyenClientKey, setAdyenClientKey] = useState("");

  // Edit firm form
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editVat, setEditVat] = useState("");
  const [editCurrency, setEditCurrency] = useState("CHF");
  const [editDomain, setEditDomain] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editBilling, setEditBilling] = useState<"monthly" | "yearly">("monthly");

  const isSuperadmin = user?.role === "superadmin";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/platform/login");
      return;
    }
    if (user.role !== "superadmin") navigate("/dashboard");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.preferredLocale === "en" || user?.preferredLocale === "fr" || user?.preferredLocale === "de") {
      setUiLocale(user.preferredLocale);
    }
  }, [user?.preferredLocale]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);

  const { data: stats, isLoading: statsLoading } = trpc.superadmin.getStats.useQuery(undefined, {
    enabled: isSuperadmin,
  });
  const { data: firms, isLoading: firmsLoading, refetch: refetchFirms } = trpc.superadmin.listFirms.useQuery(
    undefined,
    { enabled: isSuperadmin }
  );
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = trpc.superadmin.listPlans.useQuery(
    undefined,
    { enabled: isSuperadmin }
  );
  const { data: system } = trpc.superadmin.getSystemStatus.useQuery(undefined, { enabled: isSuperadmin });
  const { data: platformSettings, refetch: refetchPlatform } = trpc.superadmin.getPlatformSettings.useQuery(
    undefined,
    { enabled: isSuperadmin }
  );
  const { data: platformUsers, refetch: refetchUsers } = trpc.superadmin.listUsers.useQuery(
    { search: userSearch || undefined, limit: 100 },
    { enabled: isSuperadmin }
  );
  const { data: auditLog } = trpc.superadmin.listAuditLog.useQuery(
    { limit: 50 },
    { enabled: isSuperadmin }
  );
  const { data: firmDetail, isLoading: firmDetailLoading } = trpc.superadmin.getFirmDetail.useQuery(
    { firmId: selectedFirmId! },
    { enabled: isSuperadmin && !!selectedFirmId }
  );

  useEffect(() => {
    if (!platformSettings) return;
    setAgencyName(platformSettings.agencyName);
    setLogoUrl(platformSettings.logoUrl);
    setSupportEmail(platformSettings.supportEmail);
    setDefaultLocale(platformSettings.defaultLocale);
    setLocaleEn(platformSettings.supportedLocales.includes("en"));
    setLocaleFr(platformSettings.supportedLocales.includes("fr"));
    setLocaleDe(platformSettings.supportedLocales.includes("de"));
    setVatStandard(String(platformSettings.vatRates.standard));
    setVatReduced(String(platformSettings.vatRates.reduced));
    setVatSpecial(String(platformSettings.vatRates.special));
    setVatZero(String(platformSettings.vatRates.zero));
    setAdyenMerchant(platformSettings.adyen.merchantAccount);
  }, [platformSettings]);

  const createFirmMutation = trpc.superadmin.createFirm.useMutation({
    onSuccess: (data) => {
      toast.success(data.credentialsSent ? "Firm created — credentials emailed" : "Firm created");
      setLastCreatedCreds({ loginUrl: data.loginUrl, temporaryPassword: data.temporaryPassword });
      setShowCreateFirm(false);
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const sendCredentialsMutation = trpc.superadmin.sendFirmCredentials.useMutation({
    onSuccess: () => {
      toast.success("Credentials sent");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const setSubdomainMutation = trpc.superadmin.setSubdomainStatus.useMutation({
    onSuccess: () => {
      toast.success("Subdomain updated");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const suspendFirmMutation = trpc.superadmin.suspendFirm.useMutation({
    onSuccess: () => {
      toast.success("Firm suspended");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const reactivateFirmMutation = trpc.superadmin.reactivateFirm.useMutation({
    onSuccess: () => {
      toast.success("Firm reactivated");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateFirmMutation = trpc.superadmin.updateFirm.useMutation({
    onSuccess: () => {
      toast.success("Firm updated");
      setShowEditFirm(false);
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateSubMutation = trpc.superadmin.updateFirmSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription updated");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const createPlanMutation = trpc.superadmin.createPlan.useMutation({
    onSuccess: () => {
      toast.success("Plan created");
      setShowCreatePlan(false);
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });
  const updatePlanMutation = trpc.superadmin.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan updated");
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });
  const seedPlansMutation = trpc.superadmin.seedDefaultPlans.useMutation({
    onSuccess: (r) => {
      toast.success(r.message);
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });
  const updatePlatformMutation = trpc.superadmin.updatePlatformSettings.useMutation({
    onSuccess: () => {
      toast.success("Platform settings saved");
      refetchPlatform();
    },
    onError: (err) => toast.error(err.message),
  });
  const promoteMutation = trpc.superadmin.setupSuperadminByEmail.useMutation({
    onSuccess: (r) => {
      toast.success(r.message);
      if (r.temporaryPassword) {
        toast.message(`Temp password: ${r.temporaryPassword}`);
      }
      setNewAdminEmail("");
      setNewAdminName("");
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });
  const demoteMutation = trpc.superadmin.demoteSuperadmin.useMutation({
    onSuccess: () => {
      toast.success("Superadmin demoted");
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });
  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: (r) => {
      setAppLocale(r.locale);
      toast.success("Language updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredFirms = useMemo(() => {
    return (firms || []).filter((firm) => {
      const matchesSearch =
        !searchQuery ||
        firm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (firm.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        firm.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === "all" || firm.subscription?.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [firms, searchQuery, filterStatus]);

  const openEditFirm = (firmId: number) => {
    const firm = firms?.find((f) => f.id === firmId);
    if (!firm) return;
    setSelectedFirmId(firmId);
    setEditName(firm.name);
    setEditEmail(firm.email || "");
    setEditSlug(firm.slug);
    setEditPhone(firm.phone || "");
    setEditAddress(firm.address || "");
    setEditVat(firm.vatNumber || "");
    setEditCurrency(firm.defaultCurrency || "CHF");
    setEditDomain(firm.customDomain || "");
    setEditPlanId(firm.subscription?.planId?.toString() || "");
    setEditBilling(firm.subscription?.billingCycle || "monthly");
    setShowEditFirm(true);
  };

  const handleCreateFirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!createPlanId) {
      toast.error("Select a subscription plan");
      return;
    }
    createFirmMutation.mutate({
      name: formData.get("firmName") as string,
      email: formData.get("firmEmail") as string,
      ownerName: (formData.get("ownerName") as string) || undefined,
      address: formData.get("firmAddress") as string,
      phone: formData.get("firmPhone") as string,
      vatNumber: formData.get("vatNumber") as string,
      slug: (formData.get("firmSlug") as string) || undefined,
      planId: parseInt(createPlanId, 10),
      billingCycle: createBilling,
      sendCredentials,
      defaultCurrency: ((formData.get("defaultCurrency") as string) || "CHF").toUpperCase(),
      defaultVatRate: parseFloat((formData.get("defaultVatRate") as string) || "8.1"),
    });
  };

  const handleCreatePlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPlanMutation.mutate({
      name: formData.get("planName") as string,
      description: formData.get("planDescription") as string,
      maxUsers: parseInt(formData.get("maxUsers") as string, 10),
      monthlyPrice: parseFloat(formData.get("monthlyPrice") as string),
      yearlyPrice: parseFloat(formData.get("yearlyPrice") as string),
      features: ((formData.get("features") as string) || "")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    });
  };

  const savePlatformSettings = () => {
    const supported: Array<"en" | "fr" | "de"> = [];
    if (localeEn) supported.push("en");
    if (localeFr) supported.push("fr");
    if (localeDe) supported.push("de");
    if (!supported.length) {
      toast.error("Enable at least one language");
      return;
    }
    if (!supported.includes(defaultLocale)) {
      toast.error("Default language must be enabled");
      return;
    }
    updatePlatformMutation.mutate({
      agencyName,
      logoUrl,
      supportEmail,
      defaultLocale,
      supportedLocales: supported,
      vatRates: {
        standard: parseFloat(vatStandard) || 0,
        reduced: parseFloat(vatReduced) || 0,
        special: parseFloat(vatSpecial) || 0,
        zero: parseFloat(vatZero) || 0,
      },
      adyenApiKey: adyenApiKey || undefined,
      adyenMerchantAccount: adyenMerchant,
      adyenClientKey: adyenClientKey || undefined,
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Redirecting to platform login…
      </div>
    );
  }

  if (user.role !== "superadmin") {
    return <div className="p-8 text-center text-muted-foreground">Unauthorized. Superadmin access required.</div>;
  }

  const statCards = [
    { label: "Total Firms", value: stats?.totalFirms ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Firms", value: stats?.activeFirms ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    {
      label: "MRR / ARR proxy",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-slate-950 text-slate-100">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-semibold tracking-tight">LexFlow Platform</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Superadmin console · {user.email || user.name}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={uiLocale}
              onValueChange={(v: "en" | "fr" | "de") => {
                setUiLocale(v);
                setLocaleMutation.mutate({ locale: v });
              }}
            >
              <SelectTrigger className="w-[120px] bg-slate-900 border-slate-700 text-slate-100">
                <Languages className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-100 bg-transparent"
              onClick={() => logout().then(() => navigate("/platform/login"))}
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {lastCreatedCreds && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 text-sm space-y-1">
              <p className="font-semibold text-emerald-900">Firm provisioned</p>
              <p>
                Login:{" "}
                <a className="underline" href={lastCreatedCreds.loginUrl}>
                  {lastCreatedCreds.loginUrl}
                </a>
              </p>
              {lastCreatedCreds.temporaryPassword && (
                <p>
                  Temporary password:{" "}
                  <code className="bg-white px-1 rounded">{lastCreatedCreds.temporaryPassword}</code>
                </p>
              )}
              <Button size="sm" variant="ghost" onClick={() => setLastCreatedCreds(null)}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-6">
          <TabsList className="bg-white border flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="firms">Law firms</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-3.5 w-3.5 mr-1" /> Settings
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Activity className="h-3.5 w-3.5 mr-1" /> Audit
            </TabsTrigger>
          </TabsList>

          {/* ─── Overview ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="shadow-none">
                  <CardContent className="p-5 flex justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                      {statsLoading ? (
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      ) : (
                        <p className="text-3xl font-bold">{value}</p>
                      )}
                    </div>
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">System status</CardTitle>
                  <CardDescription>Integrations and runtime configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Email (Brevo)", system?.brevoConfigured],
                    ["OAuth (Manus)", system?.oauthConfigured],
                    ["Forge / AI", system?.forgeConfigured],
                    ["Demo auth", system?.demoAuthEnabled],
                    ["Bootstrap secret", system?.bootstrapSecretConfigured],
                  ].map(([label, ok]) => (
                    <div key={String(label)} className="flex items-center justify-between border-b py-2">
                      <span>{label}</span>
                      <Badge variant={ok ? "default" : "secondary"}>{ok ? "Configured" : "Missing"}</Badge>
                    </div>
                  ))}
                  {!system?.brevoConfigured && (
                    <div className="flex gap-2 items-start mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p className="text-xs">
                        Brevo API key is not set. Firm credential emails will be mocked until you add{" "}
                        <code>BREVO_API_KEY</code> to the server <code>.env</code> and restart the app.
                      </p>
                    </div>
                  )}
                  <div className="pt-2 text-xs text-muted-foreground space-y-1">
                    <p>APP_URL: {system?.appUrl || "—"}</p>
                    <p>Base domain: {system?.appBaseDomain || "—"}</p>
                    <p>
                      Mode: {system?.deploymentMode}
                      {system?.singleTenant ? " (single-tenant)" : ""} · Residency: {system?.dataResidency}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button onClick={() => { setTab("firms"); setShowCreateFirm(true); }}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create law firm
                  </Button>
                  <Button variant="outline" onClick={() => setTab("settings")}>
                    <Settings className="h-4 w-4 mr-1.5" /> Platform settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => seedPlansMutation.mutate()}
                    disabled={seedPlansMutation.isPending || (plans?.length ?? 0) > 0}
                  >
                    Seed default plans
                  </Button>
                  <Button variant="outline" onClick={() => setTab("users")}>
                    <Users className="h-4 w-4 mr-1.5" /> Manage platform admins
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Firms ────────────────────────────────────────────── */}
          <TabsContent value="firms" className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">Law firms</h2>
                <p className="text-sm text-muted-foreground">Provision tenants, credentials, and subdomains</p>
              </div>
              <Dialog open={showCreateFirm} onOpenChange={setShowCreateFirm}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Firm
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Firm</DialogTitle>
                    <DialogDescription>Owner receives login credentials and completes onboarding</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateFirm} className="space-y-3">
                    <div>
                      <Label>Firm name</Label>
                      <Input name="firmName" required className="mt-1" />
                    </div>
                    <div>
                      <Label>Owner name</Label>
                      <Input name="ownerName" className="mt-1" />
                    </div>
                    <div>
                      <Label>Owner login email</Label>
                      <Input name="firmEmail" type="email" required className="mt-1" />
                    </div>
                    <div>
                      <Label>Subdomain slug</Label>
                      <Input name="firmSlug" placeholder="mueller-partner" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Currency</Label>
                        <Input name="defaultCurrency" defaultValue="CHF" maxLength={3} className="mt-1" />
                      </div>
                      <div>
                        <Label>VAT %</Label>
                        <Input name="defaultVatRate" defaultValue="8.1" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input name="firmAddress" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Phone</Label>
                        <Input name="firmPhone" className="mt-1" />
                      </div>
                      <div>
                        <Label>VAT / UID</Label>
                        <Input name="vatNumber" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <Select value={createPlanId} onValueChange={setCreatePlanId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id.toString()}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Billing</Label>
                      <Select value={createBilling} onValueChange={(v) => setCreateBilling(v as "monthly" | "yearly")}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
                      Send login credentials email now
                    </label>
                    <Button type="submit" disabled={createFirmMutation.isPending} className="w-full">
                      {createFirmMutation.isPending ? "Creating…" : "Create firm"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-none">
              <CardContent className="p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Search name, email, slug…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery || filterStatus !== "all") && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterStatus("all");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>

            {firmsLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading firms…</p>
            ) : filteredFirms.length === 0 ? (
              <Card className="shadow-none">
                <CardContent className="py-10 text-center text-muted-foreground">
                  No firms yet. Create one to provision a tenant.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredFirms.map((firm) => (
                  <Card key={firm.id} className="shadow-none">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-lg">{firm.name}</p>
                          <p className="text-sm text-muted-foreground">{firm.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            slug: <code>{firm.slug}</code> · subdomain: {firm.subdomainStatus}
                            {firm.credentialsSentAt
                              ? ` · credentials sent ${new Date(firm.credentialsSentAt).toLocaleDateString()}`
                              : " · credentials not sent"}
                          </p>
                        </div>
                        <Badge
                          variant={
                            firm.subscription?.status === "active"
                              ? "default"
                              : firm.subscription?.status === "suspended"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {firm.subscription?.status || "inactive"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="default" onClick={() => setSelectedFirmId(firm.id)}>
                          Details
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditFirm(firm.id)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendCredentialsMutation.mutate({ firmId: firm.id })}
                          disabled={sendCredentialsMutation.isPending}
                        >
                          <Mail className="h-3.5 w-3.5 mr-1" /> Send credentials
                        </Button>
                        {firm.subdomainStatus !== "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSubdomainMutation.mutate({ firmId: firm.id, status: "active" })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate subdomain
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSubdomainMutation.mutate({ firmId: firm.id, status: "rejected" })}
                          >
                            Suspend subdomain
                          </Button>
                        )}
                        {firm.subscription?.status === "suspended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reactivateFirmMutation.mutate({ firmId: firm.id })}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => suspendFirmMutation.mutate({ firmId: firm.id })}
                          >
                            <Pause className="h-3.5 w-3.5 mr-1" /> Suspend
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Firm detail */}
            <Dialog open={!!selectedFirmId && !showEditFirm} onOpenChange={(o) => !o && setSelectedFirmId(null)}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{firmDetail?.firm.name}</DialogTitle>
                  <DialogDescription>{firmDetail?.firm.email}</DialogDescription>
                </DialogHeader>
                {firmDetailLoading || !firmDetail ? (
                  <p className="py-8 text-center text-muted-foreground">Loading…</p>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-muted-foreground">Plan</p>
                        <p className="font-medium">{firmDetail.plan?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Login URL</p>
                        <a className="underline break-all" href={firmDetail.loginUrl}>
                          {firmDetail.loginUrl}
                        </a>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Currency / VAT</p>
                        <p className="font-medium">
                          {firmDetail.firm.defaultCurrency} · {firmDetail.firm.defaultVatRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Members</p>
                        <p className="font-medium">{firmDetail.usageMetrics.totalMembers}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted rounded p-3">
                        <p className="text-muted-foreground">Cases</p>
                        <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalCases}</p>
                      </div>
                      <div className="bg-muted rounded p-3">
                        <p className="text-muted-foreground">Clients</p>
                        <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalClients}</p>
                      </div>
                      <div className="bg-muted rounded p-3">
                        <p className="text-muted-foreground">Documents</p>
                        <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalDocuments}</p>
                      </div>
                      <div className="bg-muted rounded p-3">
                        <p className="text-muted-foreground">Messages</p>
                        <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalMessages}</p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Edit firm */}
            <Dialog open={showEditFirm} onOpenChange={setShowEditFirm}>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit firm</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input className="mt-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input className="mt-1" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input className="mt-1" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                  </div>
                  <div>
                    <Label>Custom domain</Label>
                    <Input className="mt-1" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Currency</Label>
                      <Input className="mt-1" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input className="mt-1" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input className="mt-1" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label>VAT</Label>
                    <Input className="mt-1" value={editVat} onChange={(e) => setEditVat(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Plan</Label>
                      <Select value={editPlanId} onValueChange={setEditPlanId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Billing</Label>
                      <Select value={editBilling} onValueChange={(v) => setEditBilling(v as "monthly" | "yearly")}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      disabled={!selectedFirmId || updateFirmMutation.isPending}
                      onClick={() =>
                        selectedFirmId &&
                        updateFirmMutation.mutate({
                          firmId: selectedFirmId,
                          name: editName,
                          email: editEmail,
                          slug: editSlug,
                          phone: editPhone,
                          address: editAddress,
                          vatNumber: editVat,
                          defaultCurrency: editCurrency,
                          customDomain: editDomain || null,
                        })
                      }
                    >
                      <Save className="h-4 w-4 mr-1.5" /> Save firm
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedFirmId || !editPlanId || updateSubMutation.isPending}
                      onClick={() =>
                        selectedFirmId &&
                        updateSubMutation.mutate({
                          firmId: selectedFirmId,
                          planId: parseInt(editPlanId, 10),
                          billingCycle: editBilling,
                        })
                      }
                    >
                      Update plan
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ─── Plans ────────────────────────────────────────────── */}
          <TabsContent value="plans" className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">Subscription plans</h2>
                <p className="text-sm text-muted-foreground">Global SaaS tiers for law firms</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => seedPlansMutation.mutate()}
                  disabled={seedPlansMutation.isPending || (plans?.length ?? 0) > 0}
                >
                  Seed defaults
                </Button>
                <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Create plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreatePlan} className="space-y-3">
                      <div>
                        <Label>Name</Label>
                        <Input name="planName" required className="mt-1" />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input name="planDescription" className="mt-1" />
                      </div>
                      <div>
                        <Label>Max users</Label>
                        <Input name="maxUsers" type="number" min={1} required className="mt-1" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Monthly CHF</Label>
                          <Input name="monthlyPrice" type="number" step="0.01" required className="mt-1" />
                        </div>
                        <div>
                          <Label>Yearly CHF</Label>
                          <Input name="yearlyPrice" type="number" step="0.01" required className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label>Features (comma-separated)</Label>
                        <Textarea name="features" className="mt-1" />
                      </div>
                      <Button type="submit" disabled={createPlanMutation.isPending} className="w-full">
                        Create
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {plansLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading…</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {(plans || []).map((plan) => (
                  <Card key={plan.id} className="shadow-none">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle>{plan.name}</CardTitle>
                          <CardDescription>{plan.description}</CardDescription>
                        </div>
                        <Badge variant={plan.isActive ? "default" : "secondary"}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>
                        <span className="text-muted-foreground">Max users:</span>{" "}
                        <strong>{plan.maxUsers}</strong>
                      </p>
                      <p>
                        CHF {parseFloat(String(plan.monthlyPrice)).toFixed(2)} / mo · CHF{" "}
                        {parseFloat(String(plan.yearlyPrice)).toFixed(2)} / yr
                      </p>
                      {plan.features && (
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {(JSON.parse(plan.features as string) as string[]).map((f, i) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updatePlanMutation.mutate({ planId: plan.id, isActive: !plan.isActive })
                        }
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Users ────────────────────────────────────────────── */}
          <TabsContent value="users" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Platform users</h2>
              <p className="text-sm text-muted-foreground">
                Promote superadmins only from here — firms and clients cannot self-elevate
              </p>
            </div>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Add / promote superadmin</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input className="mt-1" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!newAdminEmail || promoteMutation.isPending}
                    onClick={() =>
                      promoteMutation.mutate({
                        email: newAdminEmail,
                        name: newAdminName || undefined,
                      })
                    }
                  >
                    Promote to superadmin
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="border rounded-lg bg-white divide-y">
              {(platformUsers || []).map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{u.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email} · {u.loginMethod || "—"} · locale {u.preferredLocale || "en"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.role === "superadmin" ? "default" : "secondary"}>{u.role}</Badge>
                    {u.role === "superadmin" && u.id !== user.id && (
                      <Button size="sm" variant="outline" onClick={() => demoteMutation.mutate({ userId: u.id })}>
                        Demote
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!platformUsers?.length && (
                <p className="p-6 text-center text-muted-foreground text-sm">No users found</p>
              )}
            </div>
          </TabsContent>

          {/* ─── Settings ─────────────────────────────────────────── */}
          <TabsContent value="settings" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Platform settings</h2>
              <p className="text-sm text-muted-foreground">
                Branding, languages, default VAT, and payment processor keys
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Platform name</Label>
                    <Input className="mt-1" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Logo URL</Label>
                    <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                  </div>
                  <div>
                    <Label>Support email</Label>
                    <Input className="mt-1" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Languages className="h-4 w-4" /> Languages
                  </CardTitle>
                  <CardDescription>EN / FR / DE for the product UI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Default locale for new users</Label>
                    <Select value={defaultLocale} onValueChange={(v: "en" | "fr" | "de") => setDefaultLocale(v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Enabled languages</Label>
                    {[
                      ["en", "English", localeEn, setLocaleEn],
                      ["fr", "Français", localeFr, setLocaleFr],
                      ["de", "Deutsch", localeDe, setLocaleDe],
                    ].map(([code, label, on, setOn]) => (
                      <div key={String(code)} className="flex items-center justify-between">
                        <span className="text-sm">{label as string}</span>
                        <Switch checked={on as boolean} onCheckedChange={setOn as (v: boolean) => void} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Default Swiss VAT rates (%)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Standard</Label>
                    <Input className="mt-1" value={vatStandard} onChange={(e) => setVatStandard(e.target.value)} />
                  </div>
                  <div>
                    <Label>Reduced</Label>
                    <Input className="mt-1" value={vatReduced} onChange={(e) => setVatReduced(e.target.value)} />
                  </div>
                  <div>
                    <Label>Special</Label>
                    <Input className="mt-1" value={vatSpecial} onChange={(e) => setVatSpecial(e.target.value)} />
                  </div>
                  <div>
                    <Label>Zero</Label>
                    <Input className="mt-1" value={vatZero} onChange={(e) => setVatZero(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Adyen (platform defaults)</CardTitle>
                  <CardDescription>
                    {platformSettings?.adyen.apiKeySet ? "API key on file" : "No API key stored"} ·{" "}
                    {platformSettings?.adyen.clientKeySet ? "client key on file" : "no client key"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>API key</Label>
                    <Input
                      type="password"
                      className="mt-1"
                      value={adyenApiKey}
                      onChange={(e) => setAdyenApiKey(e.target.value)}
                      placeholder="Leave blank to keep existing"
                    />
                  </div>
                  <div>
                    <Label>Merchant account</Label>
                    <Input className="mt-1" value={adyenMerchant} onChange={(e) => setAdyenMerchant(e.target.value)} />
                  </div>
                  <div>
                    <Label>Client key</Label>
                    <Input
                      type="password"
                      className="mt-1"
                      value={adyenClientKey}
                      onChange={(e) => setAdyenClientKey(e.target.value)}
                      placeholder="Leave blank to keep existing"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-none border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 text-sm space-y-2">
                <p className="font-medium">Email delivery (Brevo)</p>
                <p className="text-muted-foreground">
                  Status:{" "}
                  <Badge variant={system?.brevoConfigured ? "default" : "secondary"}>
                    {system?.brevoConfigured ? "Configured" : "Not configured"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Set <code>BREVO_API_KEY</code> in the server environment (not in this UI — secrets stay in{" "}
                  <code>.env</code>), then restart Docker. Without it, “Send credentials” is logged as a mock send.
                </p>
              </CardContent>
            </Card>

            <Button onClick={savePlatformSettings} disabled={updatePlatformMutation.isPending}>
              <Save className="h-4 w-4 mr-1.5" />
              {updatePlatformMutation.isPending ? "Saving…" : "Save platform settings"}
            </Button>
          </TabsContent>

          {/* ─── Audit ────────────────────────────────────────────── */}
          <TabsContent value="audit" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Audit log</h2>
              <p className="text-sm text-muted-foreground">Platform admin actions</p>
            </div>
            <div className="border rounded-lg bg-white divide-y">
              {(auditLog || []).map((row) => (
                <div key={row.id} className="px-4 py-3 text-sm flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.targetType}
                      {row.targetId != null ? ` #${row.targetId}` : ""} · admin #{row.superadminId}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {!auditLog?.length && (
                <p className="p-6 text-center text-muted-foreground text-sm">No audit events yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
