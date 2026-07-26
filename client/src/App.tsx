import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TwoFactorChallenge } from "./components/TwoFactorChallenge";
import { setAppLocale } from "./i18n";
import { isAppLocale } from "@shared/locales";
import { trpc } from "./lib/trpc";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ClientsPage from "./pages/Clients";
import ClientDetailPage from "./pages/ClientDetail";
import CasesPage from "./pages/Cases";
import CaseDetailPage from "./pages/CaseDetail";
import InvoicesPage from "./pages/Invoices";
import InvoiceDetailPage from "./pages/InvoiceDetail";
import MessagesPage from "./pages/Messages";
import SettingsPage from "./pages/Settings";
import AgendaPage from "./pages/Agenda";
import FirmPackagesPage from "./pages/FirmPackages";
import FirmServicesPage from "./pages/FirmServices";
import FirmUpsellingPage from "./pages/FirmUpselling";
import SubscribePage from "./pages/Subscribe";
import OnboardingPage from "./pages/Onboarding";
import FirmOnboardingPage from "./pages/FirmOnboarding";
import InvitePage from "./pages/Invite";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import AdminSettings from "./pages/AdminSettings";
import ClientPortalPage from "./pages/ClientPortal";
import TimeReportsPage from "./pages/TimeReports";
import AuditLogPage from "./pages/AuditLog";
import AdminAnalyticsPage from "./pages/AdminAnalytics";
import FirmLeadsPage from "./pages/FirmLeads";
import FirmCmsPage from "./pages/FirmCms";
import LoginPage from "./pages/Login";
import PlatformLoginPage from "./pages/PlatformLogin";
import FloatingTimer from "./components/FloatingTimer";
import ImpersonationBanner from "./components/ImpersonationBanner";
import TrialBanner from "./components/TrialBanner";
import AnnouncementPopup from "./components/AnnouncementPopup";
import SupportPage from "./pages/Support";
import AccountPage from "./pages/Account";
import FirmPublicSitePage from "./pages/FirmPublicSite";

function HomeOrFirmSite() {
  const [mode, setMode] = useState<"loading" | "platform" | "firm">("loading");
  useEffect(() => {
    fetch("/api/auth/tenant")
      .then((r) => r.json())
      .then((d) => setMode(d?.mode === "firm" ? "firm" : "platform"))
      .catch(() => setMode("platform"));
  }, []);
  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (mode === "firm") return <FirmPublicSitePage />;
  return <Home />;
}

/** On a firm subdomain/custom domain, unknown paths are CMS pages (e.g. /about). */
function NotFoundOrFirmPage() {
  const [mode, setMode] = useState<"loading" | "platform" | "firm">("loading");
  useEffect(() => {
    fetch("/api/auth/tenant")
      .then((r) => r.json())
      .then((d) => setMode(d?.mode === "firm" ? "firm" : "platform"))
      .catch(() => setMode("platform"));
  }, []);
  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (mode === "firm") return <FirmPublicSitePage />;
  return <NotFound />;
}

function Router() {
  const { user, refresh, loading } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });
  const firmLocked = Boolean(firmData?.subscription?.locked);
  const isFirmAdminRole =
    firmData?.member?.firmRole === "admin" || firmData?.member?.firmRole === "subadmin";

  useEffect(() => {
    if (isAppLocale(user?.preferredLocale)) {
      setAppLocale(user.preferredLocale);
    }
  }, [user?.preferredLocale]);

  useEffect(() => {
    if (loading) return;

    // Unauthenticated users hitting the platform console → platform login
    if (
      !user &&
      (location.startsWith("/superadmin") || location.startsWith("/admin"))
    ) {
      navigate("/platform/login");
      return;
    }

    if (!user) return;

    if (user.mustChangePassword && location !== "/login" && location !== "/platform/login") {
      navigate("/login");
      return;
    }

    if (user.role === "superadmin") {
      if (
        !location.startsWith("/superadmin") &&
        !location.startsWith("/admin") &&
        location !== "/platform/login"
      ) {
        navigate("/superadmin");
      }
      return;
    }

    // Non-superadmins cannot open the platform console
    if (location.startsWith("/superadmin") || location.startsWith("/admin")) {
      navigate("/dashboard");
      return;
    }

    if (
      firmData?.firm &&
      !firmData.firm.onboardingCompletedAt &&
      firmData.member.firmRole === "admin" &&
      !location.startsWith("/firm-onboarding") &&
      location !== "/login"
    ) {
      navigate("/firm-onboarding");
      return;
    }

    // Trial / subscription lockout — only account + support remain usable
    if (firmLocked && !(user as { impersonation?: unknown }).impersonation) {
      const allowedWhileLocked =
        location.startsWith("/account") ||
        location.startsWith("/support") ||
        location === "/login" ||
        location.startsWith("/firm-onboarding");
      if (!allowedWhileLocked) {
        navigate(isFirmAdminRole ? "/account" : "/support");
      }
    }
  }, [user, loading, location, navigate, firmData, firmLocked, isFirmAdminRole]);

  if (user?.requires2fa) {
    return (
      <TwoFactorChallenge
        onVerified={async () => {
          await utils.auth.me.invalidate();
          refresh?.();
        }}
      />
    );
  }

  // Avoid flashing NotFound / Unauthorized while auth or redirect settles
  if (
    loading ||
    (!user && (location.startsWith("/superadmin") || location.startsWith("/admin")))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const isAppShell =
    location.startsWith("/dashboard") ||
    location.startsWith("/clients") ||
    location.startsWith("/cases") ||
    location.startsWith("/invoices") ||
    location.startsWith("/messages") ||
    location.startsWith("/settings") ||
    location.startsWith("/account") ||
    location.startsWith("/support") ||
    location.startsWith("/agenda") ||
    location.startsWith("/upselling") ||
    location.startsWith("/packages") ||
    location.startsWith("/services") ||
    location.startsWith("/client-portal") ||
    location.startsWith("/time-reports") ||
    location.startsWith("/leads") ||
    location.startsWith("/cms") ||
    location.startsWith("/audit") ||
    location.startsWith("/analytics") ||
    location.startsWith("/admin");

  return (
    <div
      className={
        isAppShell
          ? "flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden"
          : "min-h-[100dvh]"
      }
    >
      <ImpersonationBanner />
      <TrialBanner />
      <AnnouncementPopup />
      <div className={isAppShell ? "flex-1 min-h-0 overflow-hidden" : undefined}>
        <Switch>
          <Route path="/" component={HomeOrFirmSite} />
          <Route path="/site/:firmSlug/:pageSlug" component={FirmPublicSitePage} />
          <Route path="/site/:firmSlug" component={FirmPublicSitePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/platform/login" component={PlatformLoginPage} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/firm-onboarding" component={FirmOnboardingPage} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/clients" component={ClientsPage} />
          <Route path="/clients/:id" component={ClientDetailPage} />
          <Route path="/cases" component={CasesPage} />
          <Route path="/cases/:id" component={CaseDetailPage} />
          <Route path="/invoices" component={InvoicesPage} />
          <Route path="/invoices/new" component={InvoiceDetailPage} />
          <Route path="/invoices/:id" component={InvoiceDetailPage} />
          <Route path="/messages" component={MessagesPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/account" component={AccountPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/agenda" component={AgendaPage} />
          <Route path="/upselling" component={FirmUpsellingPage} />
          <Route path="/packages" component={FirmPackagesPage} />
          <Route path="/services" component={FirmServicesPage} />
          <Route path="/subscribe/:firmSlug" component={SubscribePage} />
          <Route path="/superadmin" component={SuperadminDashboard} />
          <Route path="/superadmin/" component={SuperadminDashboard} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/client-portal" component={ClientPortalPage} />
          <Route path="/time-reports" component={TimeReportsPage} />
          <Route path="/leads" component={FirmLeadsPage} />
          <Route path="/cms" component={FirmCmsPage} />
          <Route path="/audit" component={AuditLogPage} />
          <Route path="/analytics" component={AdminAnalyticsPage} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFoundOrFirmPage} />
        </Switch>
      </div>
      {!firmLocked && <FloatingTimer />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
