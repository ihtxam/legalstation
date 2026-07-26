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
  Menu,
  X,
  BarChart3,
  Shield,
  Bell,
  Target,
  Globe,
  CalendarDays,
  Package,
  BriefcaseBusiness,
  Store,
  ChevronDown,
  LifeBuoy,
  PanelLeftClose,
  PanelLeft,
  CreditCard,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AppearanceControls from "@/components/AppearanceControls";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

type NavLeaf = {
  kind?: "link";
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

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
  const isFirmAdminRole =
    firmData?.member?.firmRole === "admin" || firmData?.member?.firmRole === "subadmin";
  const { data: ticketUnread = 0 } = trpc.supportTickets.unreadCount.useQuery(undefined, {
    enabled: Boolean(user) && isFirmAdminRole,
    refetchInterval: 60_000,
  });

  /** Desktop (≥lg): expanded vs icon rail. Mobile (<lg): drawer open/closed. */
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const upsellingActive =
    location.startsWith("/upselling") ||
    location.startsWith("/packages") ||
    location.startsWith("/services");
  const [upsellingOpen, setUpsellingOpen] = useState(upsellingActive);

  useEffect(() => {
    if (upsellingActive) setUpsellingOpen(true);
  }, [upsellingActive]);

  const isClient = !firmData;
  const isAdmin = Boolean(firmData?.capabilities?.canAccessAdminConsole);
  const isSuperadmin = user?.role === "superadmin";
  const bellCount = (unreadCount || 0) + (ticketUnread || 0);

  const clientNavItems: NavEntry[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/client-portal", label: t("nav.myCases"), icon: Briefcase },
    { href: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/invoices", label: t("nav.invoices"), icon: Receipt },
  ];

  const upsellingChildren: NavLeaf[] = [
    ...(isAdmin
      ? [{ href: "/packages", label: t("nav.packages"), icon: Package } satisfies NavLeaf]
      : []),
    { href: "/services", label: t("nav.services"), icon: BriefcaseBusiness },
  ];

  const lawyerNavItems: NavEntry[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/cases", label: t("nav.cases"), icon: Briefcase },
    { href: "/clients", label: t("nav.clients"), icon: Users },
    { href: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { href: "/leads", label: t("nav.leads"), icon: Target },
    {
      kind: "group",
      id: "upselling",
      label: t("nav.upselling"),
      icon: Store,
      href: "/upselling",
      children: upsellingChildren,
    },
    { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/invoices", label: t("nav.billing"), icon: Receipt },
    { href: "/time-reports", label: t("nav.timeReports"), icon: FileText },
    ...(isAdmin
      ? [
          { href: "/cms", label: t("nav.cms"), icon: Globe } satisfies NavLeaf,
          { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 } satisfies NavLeaf,
          { href: "/audit", label: t("nav.auditLog"), icon: Shield } satisfies NavLeaf,
        ]
      : []),
  ];

  const navItems: NavEntry[] = [
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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const showLabels = desktopExpanded;

  const navLink = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    badge?: number,
    opts?: { nested?: boolean; key?: string }
  ) => {
    const isActive = location === href || location.startsWith(href + "/");
    return (
      <Link key={opts?.key || href} href={href} onClick={() => setMobileOpen(false)}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150",
            opts?.nested ? "px-3 py-2 ms-3" : "px-3 py-2.5",
            isActive
              ? "bg-white/15 text-white dark:bg-[var(--color-sidebar-primary)]/25 dark:text-[var(--color-gold-light)]"
              : "text-white/65 hover:bg-white/10 hover:text-white dark:text-white/55 dark:hover:bg-white/8"
          )}
        >
          <Icon className={cn("shrink-0", opts?.nested ? "w-4 h-4" : "w-5 h-5")} />
          <span className={cn("flex-1 truncate", !showLabels && "lg:hidden")}>{label}</span>
          {badge != null && badge > 0 && (
            <Badge className={cn(
              "bg-[var(--color-gold)] text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center",
              !showLabels && "lg:hidden"
            )}>
              {badge > 99 ? "99+" : badge}
            </Badge>
          )}
        </div>
      </Link>
    );
  };

  const renderNavEntry = (entry: NavEntry) => {
    if (entry.kind === "group") {
      const GroupIcon = entry.icon;
      const childActive = entry.children.some(
        (c) => location === c.href || location.startsWith(c.href + "/")
      );
      const groupActive = location === entry.href || childActive;
      const open = entry.id === "upselling" ? upsellingOpen : true;
      return (
        <div key={entry.id} className="space-y-0.5">
          <div className="flex items-center gap-0.5">
            <Link
              href={entry.href}
              onClick={() => setMobileOpen(false)}
              className="min-w-0 flex-1"
            >
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150",
                  groupActive
                    ? "bg-white/15 text-white dark:bg-[var(--color-sidebar-primary)]/25 dark:text-[var(--color-gold-light)]"
                    : "text-white/65 hover:bg-white/10 hover:text-white dark:text-white/55 dark:hover:bg-white/8"
                )}
              >
                <GroupIcon className="w-5 h-5 shrink-0" />
                <span className={cn("flex-1 truncate", !showLabels && "lg:hidden")}>
                  {entry.label}
                </span>
              </div>
            </Link>
            <button
              type="button"
              className={cn(
                "p-2 rounded-lg text-white/65 hover:bg-white/10 hover:text-white shrink-0",
                !showLabels && "lg:hidden"
              )}
              aria-label={open ? "Collapse" : "Expand"}
              aria-expanded={open}
              onClick={() => {
                if (entry.id === "upselling") setUpsellingOpen((v) => !v);
              }}
            >
              <ChevronDown
                className={cn("w-4 h-4 transition-transform", open ? "rotate-0" : "-rotate-90")}
              />
            </button>
          </div>
          {open && (
            <div className={cn("space-y-0.5", !showLabels && "lg:hidden")}>
              {entry.children.map((child) =>
                navLink(child.href, child.label, child.icon, undefined, {
                  nested: true,
                  key: `${entry.id}-${child.href}`,
                })
              )}
            </div>
          )}
        </div>
      );
    }
    return navLink(
      entry.href,
      entry.label,
      entry.icon,
      entry.href === "/messages" && unreadCount ? unreadCount : undefined
    );
  };

  const sidebarInner = (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-gold)]/20 shrink-0">
          <Scale className="w-4 h-4 text-[var(--color-gold-light)]" />
        </div>
        <div className={cn("min-w-0 flex-1", !showLabels && "lg:hidden")}>
          <span className="font-serif font-semibold text-white text-lg leading-none tracking-tight">
            Cliavo
          </span>
          {firmData?.firm && (
            <p className="text-white/50 text-xs mt-0.5 truncate">{firmData.firm.name}</p>
          )}
        </div>
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="px-2 space-y-0.5">
          {items.map((entry) => renderNavEntry(entry))}
        </nav>
      </ScrollArea>

      <div className="border-t border-white/10 p-2 space-y-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {isFirmAdminRole &&
          navLink("/account", t("nav.account"), CreditCard)}
        {navLink(
          "/support",
          t("nav.support"),
          LifeBuoy,
          ticketUnread > 0 ? ticketUnread : undefined
        )}
        {navLink("/settings", t("nav.settings"), Settings)}
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/65 hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150 text-sm font-medium"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={cn(!showLabels && "lg:hidden")}>{t("nav.signOut")}</span>
        </button>
        <Separator className="bg-white/10 my-2" />
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className={cn("min-w-0", !showLabels && "lg:hidden")}>
            <p className="text-white text-sm font-medium truncate">{user?.name ?? "User"}</p>
            <p className="text-white/50 text-xs truncate">
              {roleLabel(t, firmData?.member.firmRole)}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full bg-background overflow-hidden">
      {/* Desktop / large tablet persistent sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] transition-[width] duration-300 ease-snappy shrink-0 h-full",
          desktopExpanded ? "w-64" : "w-[4.5rem]"
        )}
      >
        {sidebarInner}
      </aside>

      {/* Mobile / small tablet overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu overlay"
        />
        <aside
          className={cn(
            "absolute inset-y-0 start-0 w-[min(18rem,86vw)] max-w-full flex flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] shadow-xl transition-transform duration-300 ease-snappy pt-[env(safe-area-inset-top)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarInner}
        </aside>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 bg-card border-b border-border shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="lg:hidden p-2 -ms-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="hidden lg:inline-flex p-2 -ms-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setDesktopExpanded((v) => !v)}
            aria-label={desktopExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {desktopExpanded ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeft className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="flex items-center gap-1.5 text-sm truncate">
                {breadcrumb.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <span className="text-muted-foreground shrink-0">/</span>}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground transition-colors truncate"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium truncate">{item.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : title ? (
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{title}</h1>
            ) : null}
          </div>

          <AppearanceControls variant="bar" className="shrink-0" />
          <Link
            href={ticketUnread > 0 ? "/support" : "/messages"}
            className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors shrink-0"
            title={
              ticketUnread > 0
                ? t("support.bellTickets", { count: ticketUnread })
                : t("nav.messages")
            }
          >
            <Bell className="w-5 h-5" />
            {bellCount > 0 && (
              <span className="absolute top-0.5 end-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-[var(--color-gold)] text-[10px] leading-4 text-white text-center font-semibold">
                {bellCount > 99 ? "99+" : bellCount}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 min-h-0 overflow-auto overscroll-contain">
          <div className="min-h-full w-full max-w-[100vw]">{children}</div>
        </main>
      </div>
    </div>
  );
}
