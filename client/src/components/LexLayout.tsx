import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
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
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: Briefcase },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/invoices", label: "Billing", icon: Receipt },
];

const clientNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "My Cases", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

interface LexLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export default function LexLayout({ children, title, breadcrumb }: LexLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: firmData } = trpc.firm.myFirm.useQuery();
  const { data: unreadCount } = trpc.messages.unreadCount.useQuery();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isClient = !firmData;
  const items = isClient ? clientNavItems : navItems;

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
              <span className="font-serif font-semibold text-white text-lg leading-none tracking-tight">LexFlow</span>
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
              {sidebarOpen && <span>Settings</span>}
            </div>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/65 hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150"
            onClick={logout}>
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Sign out</span>}
          </div>
          <Separator className="bg-white/10 my-2" />
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name ?? "User"}</p>
                <p className="text-white/50 text-xs truncate">{firmData?.member.firmRole ?? "Client"}</p>
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
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-gold)] rounded-full" />
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
