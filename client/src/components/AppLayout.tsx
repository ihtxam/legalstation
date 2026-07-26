import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  MessageSquare,
  Receipt,
  Settings,
  LogOut,
  Scale,
  ChevronRight,
  BarChart3,
  Shield,
  Bell,
  Target,
  Globe,
  CalendarDays,
  Package,
  BriefcaseBusiness,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

function roleLabel(t: (key: string) => string, role?: string | null) {
  if (role === "admin") return t("roles.admin");
  if (role === "subadmin") return t("roles.subadmin");
  if (role === "lawyer") return t("roles.lawyer");
  if (role === "assistant") return t("roles.assistant");
  return t("roles.client");
}

export default function AppLayout({ children, title, breadcrumb }: AppLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: firmData } = trpc.firm.myFirm.useQuery();
  const { data: unreadCount } = trpc.messages.unreadCount.useQuery();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isClient = !firmData;
  const isAdmin = Boolean(firmData?.capabilities?.canAccessAdminConsole);
  const isSuperadmin = user?.role === "superadmin";

  const clientNavItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/client-portal", label: t("nav.myCases"), icon: Briefcase },
    { href: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/invoices", label: t("nav.invoices"), icon: Receipt },
  ];

  const lawyerNavItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/cases", label: t("nav.cases"), icon: Briefcase },
    { href: "/clients", label: t("nav.clients"), icon: Users },
    { href: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { href: "/leads", label: t("nav.leads"), icon: Target },
    { href: "/services", label: t("nav.services"), icon: BriefcaseBusiness },
    { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/invoices", label: t("nav.billing"), icon: Receipt },
    { href: "/time-reports", label: t("nav.timeReports"), icon: FileText },
    ...(isAdmin
      ? [
          { href: "/packages", label: t("nav.packages"), icon: Package },
          { href: "/cms", label: t("nav.cms"), icon: Globe },
          { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 },
          { href: "/audit", label: t("nav.auditLog"), icon: Shield },
        ]
      : []),
  ];

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/cases", label: t("nav.cases"), icon: Briefcase },
    { href: "/clients", label: t("nav.clients"), icon: Users },
    { href: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/invoices", label: t("nav.billing"), icon: Receipt },
  ];

  const items = isClient ? clientNavItems : isSuperadmin ? navItems : lawyerNavItems;

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-[var(--color-navy)] text-white transition-all duration-300 ease-snappy shrink-0",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/15 shrink-0">
            <Scale className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <span className="font-serif font-semibold text-white text-lg leading-none tracking-tight">Cliavo</span>
              {firmData?.firm && (
                <p className="text-white/50 text-xs mt-0.5 truncate">{firmData.firm.name}</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-0.5">
            {items.map(({ href, label, icon: Icon }) => {
              const isActive = location === href || location.startsWith(href + "/");
              const showBadge = href === "/messages" && unreadCount && unreadCount > 0;
              return (
                <Link key={href} href={href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  )}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1">{label}</span>
                        {showBadge && (
                          <Badge className="bg-[var(--color-gold)] text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-2 space-y-0.5">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150",
              location === "/settings" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
            )}>
              <Settings className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{t("nav.settings")}</span>}
            </div>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/65 hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150"
            onClick={logout}>
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">{t("nav.signOut")}</span>}
          </div>
          <Separator className="bg-white/10 my-2" />
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name ?? "User"}</p>
                <p className="text-white/50 text-xs truncate">
                  {roleLabel(t, firmData?.member.firmRole)}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform duration-200", sidebarOpen && "rotate-180")} />
          </button>
          <div className="flex-1 min-w-0">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="flex items-center gap-1.5 text-sm">
                {breadcrumb.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-foreground">/</span>}
                    {item.href ? (
                      <Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">{item.label}</Link>
                    ) : (
                      <span className="text-foreground font-medium">{item.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : title ? (
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              <Bell className="w-4 h-4" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-[var(--color-gold)] rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
