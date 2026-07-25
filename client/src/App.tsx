import { useEffect } from "react";
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
import OnboardingPage from "./pages/Onboarding";
import FirmOnboardingPage from "./pages/FirmOnboarding";
import InvitePage from "./pages/Invite";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import AdminSettings from "./pages/AdminSettings";
import ClientPortalPage from "./pages/ClientPortal";
import TimeReportsPage from "./pages/TimeReports";
import AuditLogPage from "./pages/AuditLog";
import AdminAnalyticsPage from "./pages/AdminAnalytics";
import LoginPage from "./pages/Login";
import PlatformLoginPage from "./pages/PlatformLogin";
import FloatingTimer from "./components/FloatingTimer";

function Router() {
  const { user, refresh, loading } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });

  useEffect(() => {
    if (user?.preferredLocale === "fr" || user?.preferredLocale === "de" || user?.preferredLocale === "en") {
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
    }
  }, [user, loading, location, navigate, firmData]);

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

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
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
        <Route path="/superadmin" component={SuperadminDashboard} />
        <Route path="/superadmin/" component={SuperadminDashboard} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/client-portal" component={ClientPortalPage} />
        <Route path="/time-reports" component={TimeReportsPage} />
        <Route path="/audit" component={AuditLogPage} />
        <Route path="/analytics" component={AdminAnalyticsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      <FloatingTimer />
    </>
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
