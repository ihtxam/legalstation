import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { setAppLocale } from "@/i18n";
import { useTranslation } from "react-i18next";
import { APP_LOCALES, APP_LOCALE_LABELS, isAppLocale, type AppLocale } from "@shared/locales";
import {
  APP_CURRENCIES,
  CURRENCY_META,
  currencyLabel,
  isAppCurrency,
  type AppCurrency,
} from "@shared/currencies";
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
  LogIn,
  Pencil,
  Megaphone,
  CalendarDays,
  HardDrive,
  Ticket,
} from "lucide-react";

type TabId =
  | "overview"
  | "firms"
  | "plans"
  | "users"
  | "leads"
  | "tickets"
  | "announcements"
  | "settings"
  | "audit";

export default function SuperadminDashboard() {
  const { t } = useTranslation();
  const { user, logout, loading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>("overview");
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{
    id: number;
    name: string;
    description: string;
    maxUsers: number;
    monthlyPrice: string;
    yearlyPrice: string;
    features: string;
    sortOrder: number;
    isActive: boolean;
  } | null>(null);
  const [showEditFirm, setShowEditFirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedFirmId, setSelectedFirmId] = useState<number | null>(null);
  const [createPlanId, setCreatePlanId] = useState("");
  const [createBilling, setCreateBilling] = useState<"monthly" | "yearly">("monthly");
  const [createFirmCurrency, setCreateFirmCurrency] = useState<AppCurrency>("CHF");
  const [sendCredentials, setSendCredentials] = useState(true);
  const [lastCreatedCreds, setLastCreatedCreds] = useState<{
    loginUrl: string;
    temporaryPassword?: string;
  } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [uiLocale, setUiLocale] = useState<AppLocale>("en");

  // Platform settings form state
  const [agencyName, setAgencyName] = useState("Cliavo");
  const [logoUrl, setLogoUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<AppLocale>("en");
  const [localeEn, setLocaleEn] = useState(true);
  const [localeFr, setLocaleFr] = useState(true);
  const [localeDe, setLocaleDe] = useState(true);
  const [localeIt, setLocaleIt] = useState(true);
  const [localeAr, setLocaleAr] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState<AppCurrency>("CHF");
  const [enabledCurrencies, setEnabledCurrencies] = useState<AppCurrency[]>([...APP_CURRENCIES]);
  const [vatStandard, setVatStandard] = useState("8.1");
  const [vatReduced, setVatReduced] = useState("2.6");
  const [vatSpecial, setVatSpecial] = useState("3.8");
  const [vatZero, setVatZero] = useState("0");
  const [adyenApiKey, setAdyenApiKey] = useState("");
  const [adyenMerchant, setAdyenMerchant] = useState("");
  const [adyenClientKey, setAdyenClientKey] = useState("");
  const [googleCalClientId, setGoogleCalClientId] = useState("");
  const [googleCalSecret, setGoogleCalSecret] = useState("");
  const [msCalClientId, setMsCalClientId] = useState("");
  const [msCalSecret, setMsCalSecret] = useState("");
  const [msCalTenant, setMsCalTenant] = useState("common");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annSeverity, setAnnSeverity] = useState<"info" | "warning" | "critical">("info");
  const [annAudience, setAnnAudience] = useState<"firm_admins" | "all_members">("firm_admins");
  const [ticketsPerMonth, setTicketsPerMonth] = useState("10");
  const [ticketFilter, setTicketFilter] = useState<
    "all" | "open" | "processing" | "under_review" | "responded" | "resolved" | "closed"
  >("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketReplyStatus, setTicketReplyStatus] = useState<
    "processing" | "under_review" | "responded" | "resolved"
  >("responded");

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
  const [editStorageGb, setEditStorageGb] = useState("10");

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
    if (isAppLocale(user?.preferredLocale)) {
      setUiLocale(user.preferredLocale);
    }
  }, [user?.preferredLocale]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(CURRENCY_META[defaultCurrency].locale, {
      style: "currency",
      currency: defaultCurrency,
    }).format(amount);

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
  const { data: platformLeads, refetch: refetchLeads } = trpc.leads.list.useQuery(
    { limit: 100 },
    { enabled: isSuperadmin && tab === "leads" }
  );
  const updateLeadStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.leadStatusUpdated"));
      void refetchLeads();
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: firmDetail, isLoading: firmDetailLoading } = trpc.superadmin.getFirmDetail.useQuery(
    { firmId: selectedFirmId! },
    { enabled: isSuperadmin && !!selectedFirmId }
  );

  useEffect(() => {
    if (!platformSettings) return;
    setAgencyName(platformSettings.agencyName);
    setLogoUrl(platformSettings.logoUrl);
    setSupportEmail(platformSettings.supportEmail);
    setDefaultLocale(
      isAppLocale(platformSettings.defaultLocale) ? platformSettings.defaultLocale : "en"
    );
    setLocaleEn(platformSettings.supportedLocales.includes("en"));
    setLocaleFr(platformSettings.supportedLocales.includes("fr"));
    setLocaleDe(platformSettings.supportedLocales.includes("de"));
    setLocaleIt(platformSettings.supportedLocales.includes("it"));
    setLocaleAr(platformSettings.supportedLocales.includes("ar"));
    const currencies = (platformSettings.supportedCurrencies || [])
      .map((c) => String(c).toUpperCase())
      .filter(isAppCurrency);
    setEnabledCurrencies(currencies.length ? currencies : [...APP_CURRENCIES]);
    setDefaultCurrency(
      isAppCurrency(platformSettings.defaultCurrency) &&
        (currencies.length ? currencies : APP_CURRENCIES).includes(platformSettings.defaultCurrency)
        ? platformSettings.defaultCurrency
        : "CHF"
    );
    setVatStandard(String(platformSettings.vatRates.standard));
    setVatReduced(String(platformSettings.vatRates.reduced));
    setVatSpecial(String(platformSettings.vatRates.special));
    setVatZero(String(platformSettings.vatRates.zero));
    setAdyenMerchant(platformSettings.adyen.merchantAccount);
    setGoogleCalClientId(platformSettings.calendar?.googleClientId || "");
    setMsCalClientId(platformSettings.calendar?.microsoftClientId || "");
    setMsCalTenant(platformSettings.calendar?.microsoftTenant || "common");
    setTicketsPerMonth(String(platformSettings.supportTicketsPerMonth ?? 10));
  }, [platformSettings]);

  const createFirmMutation = trpc.superadmin.createFirm.useMutation({
    onSuccess: (data) => {
      toast.success(data.credentialsSent ? t("superadmin.firmCreatedEmailed") : t("superadmin.firmCreated"));
      setLastCreatedCreds({ loginUrl: data.loginUrl, temporaryPassword: data.temporaryPassword });
      setShowCreateFirm(false);
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const sendCredentialsMutation = trpc.superadmin.sendFirmCredentials.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.credentialsSent"));
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const setSubdomainMutation = trpc.superadmin.setSubdomainStatus.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.subdomainUpdated"));
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const suspendFirmMutation = trpc.superadmin.suspendFirm.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.firmSuspended"));
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const reactivateFirmMutation = trpc.superadmin.reactivateFirm.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.firmReactivated"));
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateFirmMutation = trpc.superadmin.updateFirm.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.firmUpdated"));
      setShowEditFirm(false);
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateSubMutation = trpc.superadmin.updateFirmSubscription.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.subscriptionUpdated"));
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });
  const createPlanMutation = trpc.superadmin.createPlan.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.planCreated"));
      setShowCreatePlan(false);
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });
  const updatePlanMutation = trpc.superadmin.updatePlan.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.planUpdated"));
      setEditingPlan(null);
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();
  const impersonateMutation = trpc.superadmin.impersonateFirmAdmin.useMutation({
    onSuccess: async (data) => {
      toast.success(`Logged in as admin of ${data.firmName}`);
      await utils.invalidate();
      navigate(data.redirectTo || "/dashboard");
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
      toast.success(t("superadmin.platformSaved"));
      setGoogleCalSecret("");
      setMsCalSecret("");
      refetchPlatform();
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: announcements, refetch: refetchAnnouncements } = trpc.superadmin.listAnnouncements.useQuery(
    undefined,
    { enabled: isSuperadmin && tab === "announcements" }
  );
  const createAnnouncementMutation = trpc.superadmin.createAnnouncement.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.announcementCreated"));
      setAnnTitle("");
      setAnnBody("");
      setAnnSeverity("info");
      setAnnAudience("firm_admins");
      void refetchAnnouncements();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateAnnouncementMutation = trpc.superadmin.updateAnnouncement.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.announcementUpdated"));
      void refetchAnnouncements();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteAnnouncementMutation = trpc.superadmin.deleteAnnouncement.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.announcementDeleted"));
      void refetchAnnouncements();
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: supportTickets, refetch: refetchSupportTickets } =
    trpc.superadmin.listSupportTickets.useQuery(
      { status: ticketFilter, limit: 100 },
      { enabled: isSuperadmin && tab === "tickets" }
    );
  const { data: supportTicketDetail, refetch: refetchTicketDetail } =
    trpc.superadmin.getSupportTicket.useQuery(
      { id: selectedTicketId! },
      { enabled: isSuperadmin && selectedTicketId != null }
    );
  const updateTicketStatusMutation = trpc.superadmin.updateSupportTicketStatus.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.ticketStatusUpdated"));
      void refetchSupportTickets();
      void refetchTicketDetail();
    },
    onError: (err) => toast.error(err.message),
  });
  const replyTicketMutation = trpc.superadmin.replySupportTicket.useMutation({
    onSuccess: () => {
      toast.success(t("superadmin.ticketReplySent"));
      setTicketReply("");
      void refetchSupportTickets();
      void refetchTicketDetail();
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
      toast.success(t("superadmin.demoted"));
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });
  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: (r) => {
      if (isAppLocale(r.locale)) setAppLocale(r.locale);
      toast.success(t("superadmin.localeUpdated"));
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
    const bytes = Number((firm as { storageQuotaBytes?: number }).storageQuotaBytes || 10_737_418_240);
    const gb = Math.round(bytes / (1024 * 1024 * 1024));
    setEditStorageGb(String([2, 10, 50].includes(gb) ? gb : gb || 10));
    setShowEditFirm(true);
  };

  const handleCreateFirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!createPlanId) {
      toast.error(t("superadmin.selectPlan"));
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
      defaultCurrency: createFirmCurrency,
      defaultVatRate: parseFloat((formData.get("defaultVatRate") as string) || "8.1"),
    });
  };

  const openEditPlan = (plan: {
    id: number;
    name: string;
    description: string | null;
    maxUsers: number;
    monthlyPrice: string | number;
    yearlyPrice: string | number;
    features: string | null;
    sortOrder: number;
    isActive: boolean;
  }) => {
    let featuresText = "";
    try {
      featuresText = plan.features ? (JSON.parse(plan.features) as string[]).join(", ") : "";
    } catch {
      featuresText = plan.features || "";
    }
    setEditingPlan({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      maxUsers: plan.maxUsers,
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
      features: featuresText,
      sortOrder: plan.sortOrder ?? 0,
      isActive: plan.isActive,
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
    const supported: AppLocale[] = [];
    if (localeEn) supported.push("en");
    if (localeFr) supported.push("fr");
    if (localeDe) supported.push("de");
    if (localeIt) supported.push("it");
    if (localeAr) supported.push("ar");
    if (!supported.length) {
      toast.error(t("superadmin.enableOneLanguage"));
      return;
    }
    if (!supported.includes(defaultLocale)) {
      toast.error(t("superadmin.defaultMustBeEnabled"));
      return;
    }
    if (!enabledCurrencies.length) {
      toast.error(t("superadmin.enableOneCurrency"));
      return;
    }
    if (!enabledCurrencies.includes(defaultCurrency)) {
      toast.error(t("superadmin.defaultCurrencyMustBeEnabled"));
      return;
    }
    updatePlatformMutation.mutate({
      agencyName,
      logoUrl,
      supportEmail,
      defaultLocale,
      supportedLocales: supported,
      defaultCurrency,
      supportedCurrencies: enabledCurrencies,
      vatRates: {
        standard: parseFloat(vatStandard) || 0,
        reduced: parseFloat(vatReduced) || 0,
        special: parseFloat(vatSpecial) || 0,
        zero: parseFloat(vatZero) || 0,
      },
      adyenApiKey: adyenApiKey || undefined,
      adyenMerchantAccount: adyenMerchant,
      adyenClientKey: adyenClientKey || undefined,
      googleCalendarClientId: googleCalClientId,
      googleCalendarClientSecret: googleCalSecret || undefined,
      microsoftCalendarClientId: msCalClientId,
      microsoftCalendarClientSecret: msCalSecret || undefined,
      microsoftCalendarTenant: msCalTenant || "common",
      supportTicketsPerMonth: Math.max(0, parseInt(ticketsPerMonth, 10) || 0),
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
    { label: t("superadmin.statTotalFirms"), value: stats?.totalFirms ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t("superadmin.statActiveFirms"), value: stats?.activeFirms ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: t("superadmin.statTotalUsers"), value: stats?.totalUsers ?? 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    {
      label: t("superadmin.statMrr"),
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-slate-950 text-slate-100">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t("superadmin.title")}</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {t("superadmin.subtitle", { who: user.email || user.name })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={uiLocale}
              onValueChange={(v) => {
                const locale = v as AppLocale;
                setUiLocale(locale);
                setLocaleMutation.mutate({ locale });
              }}
            >
              <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-slate-100">
                <Languages className="h-3.5 w-3.5 mr-1" />
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
              variant="outline"
              className="border-slate-700 text-slate-100 bg-transparent"
              onClick={() => logout().then(() => navigate("/platform/login"))}
            >
              <LogOut className="h-4 w-4 mr-1.5" /> {t("superadmin.signOut")}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {lastCreatedCreds && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 text-sm space-y-1">
              <p className="font-semibold text-emerald-900">{t("superadmin.firmProvisioned")}</p>
              <p>
                {t("superadmin.loginLabel")}{" "}
                <a className="underline" href={lastCreatedCreds.loginUrl}>
                  {lastCreatedCreds.loginUrl}
                </a>
              </p>
              {lastCreatedCreds.temporaryPassword && (
                <p>
                  {t("superadmin.tempPassword")}{" "}
                  <code className="bg-background px-1 rounded">{lastCreatedCreds.temporaryPassword}</code>
                </p>
              )}
              <Button size="sm" variant="ghost" onClick={() => setLastCreatedCreds(null)}>
                {t("superadmin.dismiss")}
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-6">
          <TabsList className="bg-card border flex-wrap h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">{t("superadmin.tabOverview")}</TabsTrigger>
            <TabsTrigger value="firms">{t("superadmin.tabFirms")}</TabsTrigger>
            <TabsTrigger value="plans">{t("superadmin.tabPlans")}</TabsTrigger>
            <TabsTrigger value="users">{t("superadmin.tabUsers")}</TabsTrigger>
            <TabsTrigger value="leads">
              <Mail className="h-3.5 w-3.5 mr-1" /> {t("superadmin.tabLeads")}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="h-3.5 w-3.5 mr-1" /> {t("superadmin.tabTickets")}
            </TabsTrigger>
            <TabsTrigger value="announcements">
              <Megaphone className="h-3.5 w-3.5 mr-1" /> {t("superadmin.tabAnnouncements")}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-3.5 w-3.5 mr-1" /> {t("superadmin.tabSettings")}
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Activity className="h-3.5 w-3.5 mr-1" /> {t("superadmin.tabAudit")}
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
                  <CardTitle className="text-base">{t("superadmin.systemStatus")}</CardTitle>
                  <CardDescription>{t("superadmin.systemStatusDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {(
                    [
                      {
                        label: t("superadmin.integrationEmail"),
                        ok: system?.brevoConfigured,
                        badgeMissing: t("superadmin.recommended"),
                      },
                      {
                        label: t("superadmin.integrationOauth"),
                        ok: system?.oauthConfigured,
                        badgeMissing: t("superadmin.optional"),
                      },
                      {
                        label: t("superadmin.integrationForge"),
                        ok: system?.forgeConfigured,
                        badgeMissing: t("superadmin.recommended"),
                      },
                      {
                        label: t("superadmin.integrationDemo"),
                        ok: system?.demoAuthEnabled,
                        badgeMissing: t("superadmin.optional"),
                      },
                      {
                        label: t("superadmin.integrationBootstrap"),
                        ok: system?.bootstrapSecretConfigured,
                        badgeMissing: t("superadmin.optional"),
                      },
                    ] as const
                  ).map(({ label, ok, badgeMissing }) => (
                    <div key={label} className="flex items-center justify-between border-b py-2 gap-3">
                      <span>{label}</span>
                      <Badge variant={ok ? "default" : "secondary"}>
                        {ok ? t("superadmin.configured") : badgeMissing}
                      </Badge>
                    </div>
                  ))}
                  {!system?.oauthConfigured && (
                    <div className="flex gap-2 items-start mt-3 p-3 rounded-lg bg-muted border text-foreground">
                      <p className="text-xs">{t("superadmin.oauthHint")}</p>
                    </div>
                  )}
                  {!system?.forgeConfigured && (
                    <div className="flex gap-2 items-start mt-3 p-3 rounded-lg bg-muted border text-foreground">
                      <p className="text-xs">{t("superadmin.forgeHint")}</p>
                    </div>
                  )}
                  {!system?.brevoConfigured && (
                    <div className="flex gap-2 items-start mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p className="text-xs">{t("superadmin.brevoHint")}</p>
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
                        <Label>{t("superadmin.currency")}</Label>
                        <Select
                          value={createFirmCurrency}
                          onValueChange={(v) => setCreateFirmCurrency(v as AppCurrency)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {enabledCurrencies.map((code) => (
                              <SelectItem key={code} value={code}>
                                {currencyLabel(code)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <SelectValue placeholder={t("superadmin.selectPlanPlaceholder")} />
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
                      {createFirmMutation.isPending ? t("superadmin.creatingFirm") : t("superadmin.createFirm")}
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
                    placeholder={t("superadmin.searchFirms")}
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
                          onClick={() => impersonateMutation.mutate({ firmId: firm.id })}
                          disabled={impersonateMutation.isPending}
                        >
                          <LogIn className="h-3.5 w-3.5 mr-1" /> {t("superadmin.loginAsAdmin")}
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
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (!selectedFirmId) return;
                        impersonateMutation.mutate({ firmId: selectedFirmId });
                      }}
                      disabled={impersonateMutation.isPending}
                    >
                      <LogIn className="h-4 w-4 mr-1.5" />
                      {impersonateMutation.isPending ? t("superadmin.openingAsAdmin") : t("superadmin.loginAsAdmin")}
                    </Button>
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
                      <Label>{t("superadmin.currency")}</Label>
                      <Select value={editCurrency} onValueChange={setEditCurrency}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            enabledCurrencies.includes(editCurrency as AppCurrency)
                              ? enabledCurrencies
                              : [editCurrency as AppCurrency, ...enabledCurrencies]
                          ).map((code) => (
                            <SelectItem key={code} value={code}>
                              {currencyLabel(code)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" />
                      {t("superadmin.storageQuota")}
                    </Label>
                    <Select value={editStorageGb} onValueChange={setEditStorageGb}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 GB</SelectItem>
                        <SelectItem value="10">10 GB ({t("superadmin.storageDefault")})</SelectItem>
                        <SelectItem value="50">50 GB</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">{t("superadmin.storageQuotaHint")}</p>
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
                          // Server slugifies; strip obvious junk before send
                          slug: editSlug
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, ""),
                          phone: editPhone,
                          address: editAddress,
                          vatNumber: editVat,
                          defaultCurrency: editCurrency,
                          customDomain: editDomain || null,
                          storageQuotaGb: parseInt(editStorageGb, 10) || 10,
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
                <h2 className="text-xl font-semibold">{t("superadmin.plansTitle")}</h2>
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
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updatePlanMutation.mutate({ planId: plan.id, isActive: !plan.isActive })
                          }
                        >
                          {plan.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Dialog open={!!editingPlan} onOpenChange={(o) => !o && setEditingPlan(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("superadmin.editPlan")}</DialogTitle>
                  <DialogDescription>Update pricing, limits, and feature list</DialogDescription>
                </DialogHeader>
                {editingPlan && (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      updatePlanMutation.mutate({
                        planId: editingPlan.id,
                        name: editingPlan.name.trim(),
                        description: editingPlan.description.trim() || null,
                        maxUsers: editingPlan.maxUsers,
                        monthlyPrice: parseFloat(editingPlan.monthlyPrice) || 0,
                        yearlyPrice: parseFloat(editingPlan.yearlyPrice) || 0,
                        sortOrder: editingPlan.sortOrder,
                        isActive: editingPlan.isActive,
                        features: editingPlan.features
                          .split(",")
                          .map((f) => f.trim())
                          .filter(Boolean),
                      });
                    }}
                  >
                    <div>
                      <Label>Name</Label>
                      <Input
                        className="mt-1"
                        required
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        className="mt-1"
                        value={editingPlan.description}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Max users</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          min={1}
                          required
                          value={editingPlan.maxUsers}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              maxUsers: parseInt(e.target.value, 10) || 1,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Sort order</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          value={editingPlan.sortOrder}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Monthly CHF</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          step="0.01"
                          required
                          value={editingPlan.monthlyPrice}
                          onChange={(e) =>
                            setEditingPlan({ ...editingPlan, monthlyPrice: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Yearly CHF</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          step="0.01"
                          required
                          value={editingPlan.yearlyPrice}
                          onChange={(e) =>
                            setEditingPlan({ ...editingPlan, yearlyPrice: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Features (comma-separated)</Label>
                      <Textarea
                        className="mt-1"
                        value={editingPlan.features}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, features: e.target.value })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editingPlan.isActive}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, isActive: e.target.checked })
                        }
                      />
                      Active plan
                    </label>
                    <Button type="submit" className="w-full" disabled={updatePlanMutation.isPending}>
                      {updatePlanMutation.isPending ? t("superadmin.savingPlan") : t("superadmin.savePlan")}
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
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
                placeholder={t("superadmin.searchUsers")}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="border rounded-lg bg-card divide-y">
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
                    <Label>{t("superadmin.platformName")}</Label>
                    <Input className="mt-1" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("superadmin.logoUrl")}</Label>
                    <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("superadmin.supportEmail")}</Label>
                    <Input className="mt-1" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("superadmin.ticketsPerMonth")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      className="mt-1"
                      value={ticketsPerMonth}
                      onChange={(e) => setTicketsPerMonth(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("superadmin.ticketsPerMonthHint")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Languages className="h-4 w-4" /> {t("superadmin.languages")}
                  </CardTitle>
                  <CardDescription>{t("superadmin.languagesDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>{t("superadmin.defaultLocale")}</Label>
                    <Select
                      value={defaultLocale}
                      onValueChange={(v) => setDefaultLocale(v as AppLocale)}
                    >
                      <SelectTrigger className="mt-1">
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
                  </div>
                  <div className="space-y-2">
                    <Label>{t("superadmin.enabledLanguages")}</Label>
                    {(
                      [
                        ["en", t("superadmin.langEnglish"), localeEn, setLocaleEn],
                        ["fr", t("superadmin.langFrench"), localeFr, setLocaleFr],
                        ["de", t("superadmin.langGerman"), localeDe, setLocaleDe],
                        ["it", t("superadmin.langItalian"), localeIt, setLocaleIt],
                        ["ar", t("superadmin.langArabic"), localeAr, setLocaleAr],
                      ] as const
                    ).map(([code, label, on, setOn]) => (
                      <div key={code} className="flex items-center justify-between">
                        <span className="text-sm">{label}</span>
                        <Switch checked={on} onCheckedChange={setOn} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> {t("superadmin.currencies")}
                  </CardTitle>
                  <CardDescription>{t("superadmin.currenciesDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>{t("superadmin.defaultCurrency")}</Label>
                    <Select
                      value={defaultCurrency}
                      onValueChange={(v) => setDefaultCurrency(v as AppCurrency)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APP_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {currencyLabel(code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("superadmin.enabledCurrencies")}</Label>
                    {APP_CURRENCIES.map((code) => {
                      const on = enabledCurrencies.includes(code);
                      return (
                        <div key={code} className="flex items-center justify-between gap-3">
                          <span className="text-sm">{currencyLabel(code)}</span>
                          <Switch
                            checked={on}
                            onCheckedChange={(checked) => {
                              setEnabledCurrencies((prev) => {
                                if (checked) return prev.includes(code) ? prev : [...prev, code];
                                return prev.filter((c) => c !== code);
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("superadmin.swissQrCurrencyNote")}</p>
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
                      placeholder={t("superadmin.leaveBlank")}
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
                      placeholder={t("superadmin.leaveBlank")}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {t("superadmin.calendarOAuthTitle")}
                  </CardTitle>
                  <CardDescription>{t("superadmin.calendarOAuthDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Google Calendar</p>
                    <p className="text-xs text-muted-foreground">
                      {platformSettings?.calendar?.googleSecretSet
                        ? t("superadmin.secretOnFile")
                        : t("superadmin.secretMissing")}
                    </p>
                    <div>
                      <Label>Client ID</Label>
                      <Input
                        className="mt-1"
                        value={googleCalClientId}
                        onChange={(e) => setGoogleCalClientId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Client secret</Label>
                      <Input
                        type="password"
                        className="mt-1"
                        value={googleCalSecret}
                        onChange={(e) => setGoogleCalSecret(e.target.value)}
                        placeholder={t("superadmin.leaveBlank")}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Microsoft Outlook</p>
                    <p className="text-xs text-muted-foreground">
                      {platformSettings?.calendar?.microsoftSecretSet
                        ? t("superadmin.secretOnFile")
                        : t("superadmin.secretMissing")}
                    </p>
                    <div>
                      <Label>Client ID</Label>
                      <Input
                        className="mt-1"
                        value={msCalClientId}
                        onChange={(e) => setMsCalClientId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Client secret</Label>
                      <Input
                        type="password"
                        className="mt-1"
                        value={msCalSecret}
                        onChange={(e) => setMsCalSecret(e.target.value)}
                        placeholder={t("superadmin.leaveBlank")}
                      />
                    </div>
                    <div>
                      <Label>Tenant</Label>
                      <Input
                        className="mt-1"
                        value={msCalTenant}
                        onChange={(e) => setMsCalTenant(e.target.value)}
                        placeholder="common"
                      />
                    </div>
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
                    {system?.brevoConfigured ? t("superadmin.configured") : t("superadmin.notConfigured")}
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
              {updatePlatformMutation.isPending ? t("superadmin.saving") : t("superadmin.savePlatform")}
            </Button>
          </TabsContent>

          {/* ─── Support tickets ──────────────────────────────────── */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("superadmin.ticketsTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("superadmin.ticketsSubtitle")}</p>
              </div>
              <div className="w-[200px]">
                <Label>{t("superadmin.ticketFilter")}</Label>
                <Select
                  value={ticketFilter}
                  onValueChange={(v) => setTicketFilter(v as typeof ticketFilter)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="under_review">Under review</SelectItem>
                    <SelectItem value="responded">Responded</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border rounded-lg bg-card divide-y">
              {(supportTickets || []).map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="w-full text-start px-4 py-3 hover:bg-muted/40"
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{ticket.ticketNumber}</span>
                    <Badge variant="outline">{ticket.status}</Badge>
                    <Badge variant="secondary">{ticket.sensitivity}</Badge>
                    <span className="text-sm font-medium truncate">{ticket.subject}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.firmName || `Firm #${ticket.firmId}`} · {ticket.creatorEmail || "—"} ·{" "}
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </p>
                </button>
              ))}
              {!supportTickets?.length && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {t("superadmin.noTickets")}
                </p>
              )}
            </div>

            <Dialog
              open={selectedTicketId != null}
              onOpenChange={(o) => {
                if (!o) {
                  setSelectedTicketId(null);
                  setTicketReply("");
                }
              }}
            >
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {supportTicketDetail?.ticket.ticketNumber} — {supportTicketDetail?.ticket.subject}
                  </DialogTitle>
                  <DialogDescription>
                    {supportTicketDetail?.firmName || `Firm #${supportTicketDetail?.ticket.firmId}`} ·{" "}
                    {supportTicketDetail?.ticket.sensitivity}
                  </DialogDescription>
                </DialogHeader>
                {supportTicketDetail && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {supportTicketDetail.firmName || t("superadmin.unknownFirm")}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ID #{supportTicketDetail.ticket.firmId}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTicketId(null);
                            setTab("firms");
                            setSelectedFirmId(supportTicketDetail.ticket.firmId);
                          }}
                        >
                          {t("superadmin.viewFirmAccount")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={impersonateMutation.isPending}
                          onClick={() =>
                            impersonateMutation.mutate({ firmId: supportTicketDetail.ticket.firmId })
                          }
                        >
                          <LogIn className="w-3.5 h-3.5 mr-1" /> {t("superadmin.loginAsAdmin")}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Label>{t("superadmin.ticketStatus")}</Label>
                      <Select
                        value={supportTicketDetail.ticket.status}
                        onValueChange={(status) =>
                          updateTicketStatusMutation.mutate({
                            id: supportTicketDetail.ticket.id,
                            status: status as
                              | "open"
                              | "processing"
                              | "under_review"
                              | "responded"
                              | "resolved"
                              | "closed",
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="under_review">Under review</SelectItem>
                          <SelectItem value="responded">Responded</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                      {supportTicketDetail.messages.map((m) => (
                        <div key={m.id} className="border rounded-lg p-3 text-sm">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {m.authorKind === "superadmin"
                                ? "Cliavo"
                                : m.authorName || m.authorEmail || "Firm"}
                            </span>
                            <span>{new Date(m.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {supportTicketDetail.attachments
                              .filter((a) => a.messageId === m.id)
                              .map((a) => (
                                <a
                                  key={a.id}
                                  href={a.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs underline"
                                >
                                  {a.fileName}
                                </a>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {supportTicketDetail.ticket.status !== "closed" && (
                      <div className="space-y-2 border-t pt-3">
                        <Label>{t("superadmin.ticketReply")}</Label>
                        <Textarea
                          rows={4}
                          value={ticketReply}
                          onChange={(e) => setTicketReply(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <Label>{t("superadmin.ticketMarkAs")}</Label>
                            <Select
                              value={ticketReplyStatus}
                              onValueChange={(v) =>
                                setTicketReplyStatus(v as typeof ticketReplyStatus)
                              }
                            >
                              <SelectTrigger className="mt-1 w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="under_review">Under review</SelectItem>
                                <SelectItem value="responded">Responded</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            className="ml-auto"
                            disabled={!ticketReply.trim() || replyTicketMutation.isPending}
                            onClick={() =>
                              replyTicketMutation.mutate({
                                ticketId: supportTicketDetail.ticket.id,
                                body: ticketReply,
                                markStatus: ticketReplyStatus,
                              })
                            }
                          >
                            {t("superadmin.sendTicketReply")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ─── Announcements ────────────────────────────────────── */}
          <TabsContent value="announcements" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{t("superadmin.announcementsTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.announcementsSubtitle")}</p>
            </div>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">{t("superadmin.newAnnouncement")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>{t("superadmin.announcementTitle")}</Label>
                  <Input className="mt-1" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                </div>
                <div>
                  <Label>{t("superadmin.announcementBody")}</Label>
                  <Textarea className="mt-1" rows={4} value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{t("superadmin.announcementSeverity")}</Label>
                    <Select
                      value={annSeverity}
                      onValueChange={(v) => setAnnSeverity(v as "info" | "warning" | "critical")}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("superadmin.announcementAudience")}</Label>
                    <Select
                      value={annAudience}
                      onValueChange={(v) => setAnnAudience(v as "firm_admins" | "all_members")}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="firm_admins">{t("superadmin.audienceFirmAdmins")}</SelectItem>
                        <SelectItem value="all_members">{t("superadmin.audienceAllMembers")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  disabled={!annTitle.trim() || !annBody.trim() || createAnnouncementMutation.isPending}
                  onClick={() =>
                    createAnnouncementMutation.mutate({
                      title: annTitle,
                      body: annBody,
                      severity: annSeverity,
                      audience: annAudience,
                      isActive: true,
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("superadmin.publishAnnouncement")}
                </Button>
              </CardContent>
            </Card>
            <div className="border rounded-lg bg-card divide-y">
              {(announcements || []).map((a) => (
                <div key={a.id} className="px-4 py-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={a.isActive ? "default" : "secondary"}>
                        {a.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                      <Badge variant="outline">{a.severity}</Badge>
                      <Badge variant="outline">{a.audience}</Badge>
                      <p className="font-medium truncate">{a.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateAnnouncementMutation.mutate({ id: a.id, isActive: !a.isActive })
                      }
                    >
                      {a.isActive ? t("superadmin.deactivate") : t("superadmin.activate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteAnnouncementMutation.mutate({ id: a.id })}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
              {!announcements?.length && (
                <p className="p-6 text-center text-muted-foreground text-sm">
                  {t("superadmin.noAnnouncements")}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ─── Leads ────────────────────────────────────────────── */}
          <TabsContent value="leads" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{t("superadmin.leadsTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.leadsSubtitle")}</p>
            </div>
            <div className="border rounded-lg bg-card divide-y">
              {(platformLeads || []).map((lead) => (
                <div key={lead.id} className="px-4 py-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">
                        {lead.type}
                      </Badge>
                      <p className="font-medium truncate">{lead.firmName}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lead.contactName} · {lead.email}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                    </p>
                    {lead.message && (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{lead.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Select
                    value={lead.status}
                    onValueChange={(status) =>
                      updateLeadStatus.mutate({
                        id: lead.id,
                        status: status as "new" | "contacted" | "qualified" | "closed",
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">{t("superadmin.leadStatusNew")}</SelectItem>
                      <SelectItem value="contacted">{t("superadmin.leadStatusContacted")}</SelectItem>
                      <SelectItem value="qualified">{t("superadmin.leadStatusQualified")}</SelectItem>
                      <SelectItem value="closed">{t("superadmin.leadStatusClosed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {!platformLeads?.length && (
                <p className="p-6 text-center text-muted-foreground text-sm">{t("superadmin.noLeads")}</p>
              )}
            </div>
          </TabsContent>

          {/* ─── Audit ────────────────────────────────────────────── */}
          <TabsContent value="audit" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Audit log</h2>
              <p className="text-sm text-muted-foreground">Platform admin actions</p>
            </div>
            <div className="border rounded-lg bg-card divide-y">
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
