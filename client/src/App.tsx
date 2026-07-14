import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import InvitePage from "./pages/Invite";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import AdminSettings from "./pages/AdminSettings";
import ClientPortalPage from "./pages/ClientPortal";
import TimeReportsPage from "./pages/TimeReports";

function Router() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  // Redirect superadmin to /superadmin
  useEffect(() => {
    if (user?.role === "superadmin" && !location.startsWith("/superadmin") && !location.startsWith("/admin")) {
      navigate("/superadmin");
    }
  }, [user?.role, location, navigate]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/onboarding" component={OnboardingPage} />
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
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/client-portal" component={ClientPortalPage} />
      <Route path="/time-reports" component={TimeReportsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
